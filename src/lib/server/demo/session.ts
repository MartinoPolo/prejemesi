import { createHash, randomBytes } from 'node:crypto';
import { and, eq, inArray, lte, lt, or, sql } from 'drizzle-orm';
import { error, type RequestEvent } from '@sveltejs/kit';
import { getDb, type DatabaseTransaction } from '$lib/server/db/index.js';
import { demoClientThrottle, demoSession, user } from '$lib/server/db/auth.schema.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { gift, reservation } from '$lib/server/db/gift.schema.js';
import { claimInvite } from '$lib/server/db/claim.schema.js';
import { giftIngestionItem, giftIngestionRun } from '$lib/server/db/ingestion.schema.js';
import { moderatorInvite } from '$lib/server/db/moderator.schema.js';
import { notification } from '$lib/server/db/notification.schema.js';
import { generateId } from '$lib/server/db/id.js';
import type { SupportedLocale } from '$lib/i18n/locale.js';
import { provisionDemoCatalog } from './provision.js';
import {
	DEMO_CLEANUP_BATCH_SIZE,
	DEMO_CLIENT_WINDOW_MS,
	DEMO_COOKIE_MAX_AGE_SECONDS,
	DEMO_COOKIE_NAME,
	DEMO_CREATION_ADVISORY_LOCK_KEY,
	DEMO_CREATIONS_PER_CLIENT_WINDOW,
	DEMO_LIFETIME_MS,
	DEMO_SESSION_CAPACITY,
	demoEmailAddress,
} from './constants.js';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export function digestDemoToken(token: string): string | null {
	return /^[a-f0-9]{64}$/.test(token) ? digest(token) : null;
}

export function clearDemoCookie(event: RequestEvent): void {
	event.cookies.delete(DEMO_COOKIE_NAME, { path: '/' });
}

export function parseDemoCatalogLocale(value: FormDataEntryValue | null): SupportedLocale {
	return value === 'en' ? 'en' : 'cs';
}

function clientHash(event: RequestEvent): string {
	// The edge supplies this header; ignore user-controlled forwarding headers.
	return digest(
		(event.platform?.cf ? event.request.headers.get('cf-connecting-ip') : null) ??
			event.getClientAddress(),
	);
}

/**
 * Clears rows that reference demo users, wishlists, or gifts without a cascade. Ordinary demo flows
 * never create most of them, but one stray row would otherwise fail every sweep of the oldest
 * expired batch. Rows owned by real records are detached rather than deleted.
 */
async function releaseDemoDependents(transaction: DatabaseTransaction, sessionIds: string[]) {
	if (sessionIds.length === 0) {
		return;
	}
	const demoWishlists = transaction
		.select({ id: wishlist.id })
		.from(wishlist)
		.where(inArray(wishlist.demoSessionId, sessionIds));
	const demoGifts = transaction
		.select({ id: gift.id })
		.from(gift)
		.where(inArray(gift.wishlistId, demoWishlists));
	const demoUsers = transaction
		.select({ id: user.id })
		.from(user)
		.where(inArray(user.demoSessionId, sessionIds));
	await transaction.delete(reservation).where(inArray(reservation.giftId, demoGifts));
	await transaction
		.delete(moderatorInvite)
		.where(
			or(
				inArray(moderatorInvite.wishlistId, demoWishlists),
				inArray(moderatorInvite.createdByUserId, demoUsers),
			),
		);
	await transaction
		.update(moderatorInvite)
		.set({ usedByUserId: null })
		.where(inArray(moderatorInvite.usedByUserId, demoUsers));
	await transaction
		.delete(claimInvite)
		.where(
			or(
				inArray(claimInvite.wishlistId, demoWishlists),
				inArray(claimInvite.createdByUserId, demoUsers),
			),
		);
	await transaction
		.update(claimInvite)
		.set({ usedByUserId: null })
		.where(inArray(claimInvite.usedByUserId, demoUsers));
	await transaction
		.update(notification)
		.set({ actorId: null })
		.where(inArray(notification.actorId, demoUsers));
	await transaction
		.update(giftIngestionItem)
		.set({ createdGiftId: null })
		.where(inArray(giftIngestionItem.createdGiftId, demoGifts));
	await transaction
		.delete(giftIngestionRun)
		.where(inArray(giftIngestionRun.wishlistId, demoWishlists));
}

/** Callers outside a request's own demo transaction pass the database they captured before it began. */
export async function cleanExpiredDemos(database = getDb()): Promise<void> {
	await database.transaction(async (transaction) => {
		// SKIP LOCKED avoids waiting behind a visitor's edit/reset transaction.
		const expiredSessions = await transaction
			.select({ id: demoSession.id })
			.from(demoSession)
			.where(lte(demoSession.expiresAt, new Date()))
			.orderBy(demoSession.expiresAt)
			.limit(DEMO_CLEANUP_BATCH_SIZE)
			.for('update', { skipLocked: true });
		if (expiredSessions.length) {
			const expiredSessionIds = expiredSessions.map((row) => row.id);
			await releaseDemoDependents(transaction, expiredSessionIds);
			await transaction.delete(demoSession).where(inArray(demoSession.id, expiredSessionIds));
		}
		const staleClients = await transaction
			.select({ clientHash: demoClientThrottle.clientHash })
			.from(demoClientThrottle)
			.where(
				lt(
					demoClientThrottle.windowStartedAt,
					new Date(Date.now() - DEMO_CLIENT_WINDOW_MS * 2),
				),
			)
			.limit(DEMO_CLEANUP_BATCH_SIZE)
			.for('update', { skipLocked: true });
		if (staleClients.length) {
			await transaction.delete(demoClientThrottle).where(
				inArray(
					demoClientThrottle.clientHash,
					staleClients.map((row) => row.clientHash),
				),
			);
		}
	});
}

export async function findDemoSession(token: string) {
	const tokenHash = digestDemoToken(token);
	if (tokenHash === null) {
		return null;
	}
	const [row] = await getDb()
		.select()
		.from(demoSession)
		.where(eq(demoSession.tokenHash, tokenHash))
		.limit(1);
	return row !== undefined && row.expiresAt > new Date() ? row : null;
}

export async function createDemo(event: RequestEvent, locale: SupportedLocale) {
	try {
		await cleanExpiredDemos();
	} catch (failure) {
		console.error('[createDemo] expired demo cleanup failed', failure);
	}
	const database = getDb();
	const now = new Date();
	const expiresAt = new Date(now.getTime() + DEMO_LIFETIME_MS);
	const id = generateId(24);
	const viewerUserId = generateId(24);
	const token = randomBytes(32).toString('hex');
	const fingerprint = clientHash(event);
	await database.transaction(async (transaction) => {
		// A locked durable counter bounds concurrent public creation across Workers.
		await transaction
			.insert(demoClientThrottle)
			.values({ clientHash: fingerprint, windowStartedAt: now })
			.onConflictDoNothing();
		const [throttle] = await transaction
			.select()
			.from(demoClientThrottle)
			.where(eq(demoClientThrottle.clientHash, fingerprint))
			.for('update');
		if (throttle === undefined) {
			error(503, 'Demo is temporarily unavailable');
		}
		const creations =
			throttle.windowStartedAt.getTime() < now.getTime() - DEMO_CLIENT_WINDOW_MS
				? 0
				: throttle.creations;
		if (creations >= DEMO_CREATIONS_PER_CLIENT_WINDOW) {
			error(429, 'Please try the demo later');
		}
		await transaction
			.update(demoClientThrottle)
			.set({
				windowStartedAt: creations === 0 ? now : throttle.windowStartedAt,
				creations: creations + 1,
			})
			.where(eq(demoClientThrottle.clientHash, fingerprint));
		await transaction.execute(
			sql`select pg_advisory_xact_lock(${sql.raw(String(DEMO_CREATION_ADVISORY_LOCK_KEY))})`,
		);
		const [{ count }] = await transaction
			.select({ count: sql<number>`count(*)` })
			.from(demoSession);
		if (Number(count) >= DEMO_SESSION_CAPACITY) {
			error(503, 'Demo is temporarily unavailable');
		}
		await transaction.insert(demoSession).values({
			id,
			tokenHash: digest(token),
			viewerUserId,
			clientHash: fingerprint,
			createdAt: now,
			expiresAt,
		});
		await transaction.insert(user).values({
			id: viewerUserId,
			name: 'Tereza Novotná',
			email: demoEmailAddress(viewerUserId),
			demoSessionId: id,
		});
		await provisionDemoCatalog(transaction, id, viewerUserId, locale, now);
	});
	event.cookies.set(DEMO_COOKIE_NAME, token, {
		path: '/',
		httpOnly: true,
		secure: !import.meta.env.DEV,
		sameSite: 'lax',
		maxAge: DEMO_COOKIE_MAX_AGE_SECONDS,
	});
	return { id, viewerUserId, expiresAt };
}

export async function resetDemo(sessionId: string, locale: SupportedLocale) {
	await getDb().transaction(async (transaction) => {
		const [session] = await transaction
			.select()
			.from(demoSession)
			.where(eq(demoSession.id, sessionId))
			.for('update');
		if (session === undefined || session.expiresAt <= new Date()) {
			error(410, 'Demo has expired');
		}
		await releaseDemoDependents(transaction, [session.id]);
		await transaction.delete(wishlist).where(eq(wishlist.demoSessionId, session.id));
		await transaction
			.delete(user)
			.where(
				and(eq(user.demoSessionId, session.id), sql`${user.id} <> ${session.viewerUserId}`),
			);
		await provisionDemoCatalog(
			transaction,
			session.id,
			session.viewerUserId,
			locale,
			new Date(),
		);
	});
}
