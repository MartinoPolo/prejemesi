import 'use server';

import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { user } from '$lib/server/db/auth.schema.js';
import { account } from '$lib/server/db/auth.schema.js';
import { guardedQuery, guardedCommand } from '$lib/server/remote.js';

// ── Types ──────────────────────────────────────────────────────────────────

export interface UserProfile {
	id: string;
	name: string;
	email: string;
	image: string | null;
	isOAuthUser: boolean;
}

// ── Queries ────────────────────────────────────────────────────────────────

export const getUserProfile = guardedQuery(async ({ user: authUser }): Promise<UserProfile> => {
	const database = getDb();

	// Check if user has an OAuth account (non-credential provider)
	const accounts = await database
		.select({ providerId: account.providerId })
		.from(account)
		.where(eq(account.userId, authUser.id));

	const isOAuthUser = accounts.some((a) => a.providerId !== 'credential');

	return {
		id: authUser.id,
		name: authUser.name,
		email: authUser.email,
		image: authUser.image ?? null,
		isOAuthUser,
	};
});

// ── Commands ───────────────────────────────────────────────────────────────

export const updateProfile = guardedCommand(
	async ({ user: authUser }, name: string, image: string | null) => {
		const database = getDb();

		await database
			.update(user)
			.set({
				name,
				image,
				updatedAt: new Date(),
			})
			.where(eq(user.id, authUser.id));
	},
);

export const deleteAccount = guardedCommand(async ({ user: authUser }) => {
	const database = getDb();

	// Cascade delete handles sessions, accounts, etc.
	await database.delete(user).where(eq(user.id, authUser.id));
});
