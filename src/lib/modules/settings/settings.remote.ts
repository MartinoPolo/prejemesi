import { eq, and, isNull, inArray } from 'drizzle-orm';
import { getRequestEvent } from '$app/server';
import { getDb } from '$lib/server/db/index.js';
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
import { PALETTE_COOKIE_MAX_AGE_SECONDS, PALETTE_COOKIE_NAME } from '$lib/theme/palettes.js';
import {
	UpdateProfileInputSchema,
	UpdatePreferredLocaleInputSchema,
	SetUserPaletteInputSchema,
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

/**
 * Persist the viewer's app-level palette (Redesign 2026, issue #102).
 *
 * Always mirrors the choice into the `app-palette` cookie so `paletteHandle`
 * (hooks.server.ts) themes the very next request; for anonymous users the cookie
 * is the only store. Logged-in users additionally get the palette persisted on
 * their user row, which serves as the fresh-device fallback when the cookie is
 * absent. Not httpOnly: the client may read it for instant theming.
 */
export const setUserPalette = publicCommand(
	SetUserPaletteInputSchema,
	async (authContext, palette) => {
		const event = getRequestEvent();
		event.cookies.set(PALETTE_COOKIE_NAME, palette, {
			path: '/',
			maxAge: PALETTE_COOKIE_MAX_AGE_SECONDS,
			httpOnly: false,
			sameSite: 'lax',
		});

		if (authContext === null) {
			return;
		}

		await getDb()
			.update(user)
			.set({ palette, updatedAt: new Date() })
			.where(eq(user.id, authContext.user.id));
	},
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
