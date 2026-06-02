import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { user } from '$lib/server/db/auth.schema.js';
import { account } from '$lib/server/db/auth.schema.js';
import { guardedQuery, guardedCommand, guardedCommandNoArgs } from '$lib/server/remote.js';
import {
	UpdateProfileInputSchema,
	UpdateAppBackgroundThemeInputSchema,
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

	// App background theme is a custom column not carried on the session user.
	const rows = await database
		.select({ appBackgroundTheme: user.appBackgroundTheme })
		.from(user)
		.where(eq(user.id, authUser.id))
		.limit(1);

	return {
		id: authUser.id,
		name: authUser.name,
		email: authUser.email,
		image: authUser.image ?? null,
		isOAuthUser,
		appBackgroundTheme: rows[0]?.appBackgroundTheme ?? 'default',
	};
});

// ── Commands ───────────────────────────────────────────────────────────────

export const updateProfile = guardedCommand(
	UpdateProfileInputSchema,
	async ({ user: authUser }, input) => {
		const database = getDb();

		await database
			.update(user)
			.set({
				name: input.name,
				image: input.image,
				updatedAt: new Date(),
			})
			.where(eq(user.id, authUser.id));
	},
);

export const updateAppBackgroundTheme = guardedCommand(
	UpdateAppBackgroundThemeInputSchema,
	async ({ user: authUser }, input) => {
		const database = getDb();

		await database
			.update(user)
			.set({
				appBackgroundTheme: input.appBackgroundTheme,
				updatedAt: new Date(),
			})
			.where(eq(user.id, authUser.id));
	},
);

export const deleteAccount = guardedCommandNoArgs(async ({ user: authUser }) => {
	const database = getDb();

	await database.delete(user).where(eq(user.id, authUser.id));
});
