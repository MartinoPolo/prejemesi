import { eq, and, isNull, inArray } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';
import { getRequestEvent } from '$app/server';
import { getDb } from '$lib/server/db/index.js';
import { createAuth } from '$lib/server/auth.js';
import { user } from '$lib/server/db/auth.schema.js';
import { account } from '$lib/server/db/auth.schema.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { gift } from '$lib/server/db/gift.schema.js';
import {
	guardedQuery,
	guardedCommand,
	guardedCommandNoArgs,
	publicCommand,
} from '$lib/server/remote.js';
import { deleteObjectsBestEffort } from '$lib/server/storage/r2.js';
import { isStoredObjectKey, resolveUserImageUrl } from '$lib/modules/images/public_url.js';
import {
	PALETTE_COOKIE_MAX_AGE_SECONDS,
	PALETTE_COOKIE_NAME,
	type Palette,
} from '$lib/theme/palettes.js';
import {
	DEPTH_STYLE_COOKIE_MAX_AGE_SECONDS,
	DEPTH_STYLE_COOKIE_NAME,
	type DepthStyle,
} from '$lib/theme/depth_styles.js';
import {
	UpdateProfileInputSchema,
	UpdatePreferredLocaleInputSchema,
	SetUserPaletteInputSchema,
	SetUserDepthStyleInputSchema,
	type UserProfile,
} from './types.js';

export type { UserProfile } from './types.js';

// ── Queries ────────────────────────────────────────────────────────────────

export const getUserProfile = guardedQuery(async ({ user: authUser }): Promise<UserProfile> => {
	const database = getDb();

	const accounts = await database
		.select({ providerId: account.providerId })
		.from(account)
		.where(eq(account.userId, authUser.id));

	const isOAuthUser = accounts.some((a) => a.providerId !== 'credential');
	const hasGoogleAccount = accounts.some((a) => a.providerId === 'google');

	// Read profile fields from the DB (source of truth). The session user is cached by
	// better-auth and goes stale after updateProfile writes directly to the user table,
	// so reading name/image from the session would show pre-update values after a reload.
	const rows = await database
		.select({
			name: user.name,
			image: user.image,
			preferredLocale: user.preferredLocale,
		})
		.from(user)
		.where(eq(user.id, authUser.id))
		.limit(1);

	const image = rows[0]?.image ?? null;

	return {
		id: authUser.id,
		name: rows[0]?.name ?? authUser.name,
		email: authUser.email,
		image,
		imageUrl: resolveUserImageUrl(image),
		isOAuthUser,
		hasGoogleAccount,
		preferredLocale: rows[0]?.preferredLocale ?? null,
	};
});

// ── Commands ───────────────────────────────────────────────────────────────

export const updateProfile = guardedCommand(
	UpdateProfileInputSchema,
	async ({ user: authUser }, input) => {
		const database = getDb();

		const previousRows = await database
			.select({ image: user.image })
			.from(user)
			.where(eq(user.id, authUser.id))
			.limit(1);
		const previousImage = previousRows[0]?.image ?? null;

		await database
			.update(user)
			.set({
				name: input.name,
				image: input.image,
				updatedAt: new Date(),
			})
			.where(eq(user.id, authUser.id));

		// Storage cleanup (issue #107, REQ-6): a replaced or removed uploaded
		// avatar leaves no unreferenced R2 object (external URLs are untouched).
		if (
			previousImage !== null &&
			previousImage !== input.image &&
			isStoredObjectKey(previousImage)
		) {
			await deleteObjectsBestEffort([previousImage]);
		}
	},
);

/** Result of pulling the avatar from the connected Google account (issue #158). */
export type RefreshGoogleAvatarResult =
	| { ok: true; image: string; imageUrl: string | null }
	| { ok: false };

/**
 * Reads the Google `picture` claim for the linked account and persists it as the
 * user's avatar (issue #158). Existing accounts that link Google never get
 * `user.image` backfilled by better-auth, so this is the on-demand recovery path.
 *
 * The id_token is a JWT that carries `picture`; the Google provider decodes it
 * locally (no network, unaffected by token expiry), matching the OAuth sign-in
 * path. When no id_token is stored we fall back to Google's userinfo endpoint
 * with the stored (online-mode) access token, which succeeds only while unexpired.
 */
export const refreshGoogleAvatar = guardedCommandNoArgs(
	async ({ user: authUser }): Promise<RefreshGoogleAvatarResult> => {
		const event = getRequestEvent();
		const database = getDb();

		const rows = await database
			.select({ idToken: account.idToken, accessToken: account.accessToken })
			.from(account)
			.where(and(eq(account.userId, authUser.id), eq(account.providerId, 'google')))
			.limit(1);

		const googleAccount = rows[0];
		if (googleAccount === undefined) {
			return { ok: false };
		}

		const picture = await resolveGooglePictureUrl(event, googleAccount);
		if (picture === null) {
			return { ok: false };
		}

		const previousRows = await database
			.select({ image: user.image })
			.from(user)
			.where(eq(user.id, authUser.id))
			.limit(1);
		const previousImage = previousRows[0]?.image ?? null;

		await database
			.update(user)
			.set({ image: picture, updatedAt: new Date() })
			.where(eq(user.id, authUser.id));

		// Mirror updateProfile's cleanup: replacing an uploaded avatar leaves no R2 orphan.
		if (
			previousImage !== null &&
			previousImage !== picture &&
			isStoredObjectKey(previousImage)
		) {
			await deleteObjectsBestEffort([previousImage]);
		}

		return { ok: true, image: picture, imageUrl: resolveUserImageUrl(picture) };
	},
);

async function resolveGooglePictureUrl(
	event: RequestEvent,
	tokens: { idToken: string | null; accessToken: string | null },
): Promise<string | null> {
	const auth = createAuth(event);
	const authContext = await auth.$context;
	const googleProvider = authContext.socialProviders.find((provider) => provider.id === 'google');
	if (googleProvider === undefined) {
		return null;
	}

	if (tokens.idToken !== null) {
		try {
			const info = await googleProvider.getUserInfo({ idToken: tokens.idToken });
			const image = info?.user.image ?? null;
			if (image !== null && image !== '') {
				return image;
			}
		} catch {
			// Malformed/undecodable id_token – fall through to the userinfo endpoint.
		}
	}

	if (tokens.accessToken !== null) {
		return fetchGoogleUserinfoPicture(tokens.accessToken);
	}

	return null;
}

async function fetchGoogleUserinfoPicture(accessToken: string): Promise<string | null> {
	try {
		const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
			headers: { Authorization: `Bearer ${accessToken}` },
		});
		if (!response.ok) {
			return null;
		}
		const profile: unknown = await response.json();
		if (typeof profile !== 'object' || profile === null || !('picture' in profile)) {
			return null;
		}
		const picture = (profile as { picture: unknown }).picture;
		return typeof picture === 'string' && picture !== '' ? picture : null;
	} catch {
		return null;
	}
}

export const updatePreferredLocale = guardedCommand(
	UpdatePreferredLocaleInputSchema,
	async ({ user: authUser }, input) => {
		const database = getDb();

		await database
			.update(user)
			.set({
				preferredLocale: input.preferredLocale,
				updatedAt: new Date(),
			})
			.where(eq(user.id, authUser.id));
	},
);

type AppearanceAuthContext = { user: { id: string } } | null;
type AppearancePreference =
	| {
			kind: 'palette';
			cookie: {
				name: typeof PALETTE_COOKIE_NAME;
				value: Palette;
				maxAge: typeof PALETTE_COOKIE_MAX_AGE_SECONDS;
			};
			fields: { palette: Palette };
	  }
	| {
			kind: 'depthStyle';
			cookie: {
				name: typeof DEPTH_STYLE_COOKIE_NAME;
				value: DepthStyle;
				maxAge: typeof DEPTH_STYLE_COOKIE_MAX_AGE_SECONDS;
			};
			fields: { depthStyle: DepthStyle };
	  };

async function persistAppearancePreference(
	authContext: AppearanceAuthContext,
	preference: AppearancePreference,
) {
	getRequestEvent().cookies.set(preference.cookie.name, preference.cookie.value, {
		path: '/',
		maxAge: preference.cookie.maxAge,
		httpOnly: false,
		sameSite: 'lax',
	});

	if (authContext === null) {
		return;
	}

	await getDb()
		.update(user)
		.set({ ...preference.fields, updatedAt: new Date() })
		.where(eq(user.id, authContext.user.id));
}

/**
 * Persist the viewer's app-level palette (Redesign 2026, issue #102).
 *
 * Always mirrors the choice into the `app-palette` cookie so `paletteHandle`
 * (hooks.server.ts) themes the very next request; for anonymous users the cookie
 * is the only store. Logged-in users additionally get the palette persisted on
 * their user row, which serves as the fresh-device fallback when the cookie is
 * absent. Not httpOnly: the client may read it for instant theming.
 */
export const setUserPalette = publicCommand(SetUserPaletteInputSchema, (authContext, palette) =>
	persistAppearancePreference(authContext, {
		kind: 'palette',
		cookie: {
			name: PALETTE_COOKIE_NAME,
			value: palette,
			maxAge: PALETTE_COOKIE_MAX_AGE_SECONDS,
		},
		fields: { palette },
	}),
);

export const setUserDepthStyle = publicCommand(
	SetUserDepthStyleInputSchema,
	(authContext, depthStyle) =>
		persistAppearancePreference(authContext, {
			kind: 'depthStyle',
			cookie: {
				name: DEPTH_STYLE_COOKIE_NAME,
				value: depthStyle,
				maxAge: DEPTH_STYLE_COOKIE_MAX_AGE_SECONDS,
			},
			fields: { depthStyle },
		}),
);

export const deleteAccount = guardedCommandNoArgs(async ({ user: authUser }) => {
	const database = getDb();

	// Collect the uploaded images this deletion makes unreachable BEFORE the
	// cascade wipes the rows (issue #107, REQ-6): the avatar plus the images of
	// the user's own (recipient) wishlists and their gifts. For-someone lists
	// the user merely manages survive the cascade and keep their images.
	const imageKeys: (string | null)[] = [];

	const userRows = await database
		.select({ image: user.image })
		.from(user)
		.where(eq(user.id, authUser.id))
		.limit(1);
	const avatar = userRows[0]?.image ?? null;
	if (avatar !== null && isStoredObjectKey(avatar)) {
		imageKeys.push(avatar);
	}

	const ownWishlists = await database
		.select({ id: wishlist.id, imageKey: wishlist.imageKey })
		.from(wishlist)
		.where(eq(wishlist.recipientUserId, authUser.id));
	imageKeys.push(...ownWishlists.map((row) => row.imageKey));

	if (ownWishlists.length > 0) {
		const giftRows = await database
			.select({ imageKey: gift.imageKey })
			.from(gift)
			.where(
				and(
					inArray(
						gift.wishlistId,
						ownWishlists.map((row) => row.id),
					),
					isNull(gift.deletedAt),
				),
			);
		imageKeys.push(...giftRows.map((row) => row.imageKey));
	}

	await database.delete(user).where(eq(user.id, authUser.id));

	await deleteObjectsBestEffort(imageKeys);
});
