import * as v from 'valibot';
import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { user } from '$lib/server/db/auth.schema.js';
import { account } from '$lib/server/db/auth.schema.js';
import { guardedQuery, guardedCommand, guardedCommandNoArgs } from '$lib/server/remote.js';

// ── Types ──────────────────────────────────────────────────────────────────

export interface UserProfile {
	id: string;
	name: string;
	email: string;
	image: string | null;
	isOAuthUser: boolean;
}

const UpdateProfileInputSchema = v.object({
	name: v.string(),
	image: v.nullable(v.string()),
});

// ── Queries ────────────────────────────────────────────────────────────────

export const getUserProfile = guardedQuery(async ({ user: authUser }): Promise<UserProfile> => {
	const database = getDb();

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

export const deleteAccount = guardedCommandNoArgs(async ({ user: authUser }) => {
	const database = getDb();

	await database.delete(user).where(eq(user.id, authUser.id));
});
