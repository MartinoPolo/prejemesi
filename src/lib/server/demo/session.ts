import { createHash, randomBytes } from 'node:crypto';
import { and, eq, inArray, lte, lt, sql } from 'drizzle-orm';
import { error, type RequestEvent } from '@sveltejs/kit';
import { getDb } from '$lib/server/db/index.js';
import { demoClientThrottle, demoSession, user } from '$lib/server/db/auth.schema.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { gift, reservation } from '$lib/server/db/gift.schema.js';
import { generateId } from '$lib/server/db/id.js';
import { provisionDemoCatalog } from './provision.js';

export const DEMO_COOKIE = 'prejemesi_demo';
const LIFETIME_MS = 24 * 60 * 60 * 1000;

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export function digestDemoToken(token: string): string | null {
	return /^[a-f0-9]{64}$/.test(token) ? digest(token) : null;
}

export function clearDemoCookie(event: RequestEvent): void {
	event.cookies.delete(DEMO_COOKIE, { path: '/' });
}

function clientHash(event: RequestEvent): string {
	// The edge supplies this header; ignore user-controlled forwarding headers.
	return digest(
		(event.platform?.cf ? event.request.headers.get('cf-connecting-ip') : null) ??
			event.getClientAddress(),
	);
}

async function deleteDemoReservations(
	tx: Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0],
	sessionIds: string[],
) {
	if (sessionIds.length === 0) {
		return;
	}
	const ownedWishlists = tx
		.select({ id: wishlist.id })
		.from(wishlist)
		.where(inArray(wishlist.demoSessionId, sessionIds));
	const ownedGifts = tx
		.select({ id: gift.id })
		.from(gift)
		.where(inArray(gift.wishlistId, ownedWishlists));
	await tx.delete(reservation).where(inArray(reservation.giftId, ownedGifts));
}

export async function cleanExpiredDemos(): Promise<void> {
	await getDb().transaction(async (tx) => {
		// SKIP LOCKED avoids waiting behind a visitor's edit/reset transaction.
		const expired = await tx
			.select({ id: demoSession.id })
			.from(demoSession)
			.where(lte(demoSession.expiresAt, new Date()))
			.orderBy(demoSession.expiresAt)
			.limit(5)
			.for('update', { skipLocked: true });
		if (expired.length) {
			await deleteDemoReservations(
				tx,
				expired.map((row) => row.id),
			);
			await tx.delete(demoSession).where(
				sql`${demoSession.id} IN (${sql.join(
					expired.map((row) => sql`${row.id}`),
					sql`, `,
				)})`,
			);
		}
		const oldClients = await tx
			.select({ clientHash: demoClientThrottle.clientHash })
			.from(demoClientThrottle)
			.where(lt(demoClientThrottle.windowStartedAt, new Date(Date.now() - LIFETIME_MS * 2)))
			.limit(5)
			.for('update', { skipLocked: true });
		if (oldClients.length) {
			await tx.delete(demoClientThrottle).where(
				sql`${demoClientThrottle.clientHash} IN (${sql.join(
					oldClients.map((row) => sql`${row.clientHash}`),
					sql`, `,
				)})`,
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
	return row && row.expiresAt > new Date() ? row : null;
}

export async function createDemo(event: RequestEvent, locale: 'cs' | 'en') {
	await cleanExpiredDemos();
	const database = getDb();
	const now = new Date();
	const expiresAt = new Date(now.getTime() + LIFETIME_MS);
	const id = generateId(24);
	const viewerUserId = generateId(24);
	const token = randomBytes(32).toString('hex');
	const fingerprint = clientHash(event);
	await database.transaction(async (tx) => {
		// A locked durable counter bounds concurrent public creation across Workers.
		await tx
			.insert(demoClientThrottle)
			.values({ clientHash: fingerprint, windowStartedAt: now })
			.onConflictDoNothing();
		const [throttle] = await tx
			.select()
			.from(demoClientThrottle)
			.where(eq(demoClientThrottle.clientHash, fingerprint))
			.for('update');
		if (!throttle) {
			error(503, 'Demo is temporarily unavailable');
		}
		const creations =
			throttle.windowStartedAt.getTime() < now.getTime() - LIFETIME_MS
				? 0
				: throttle.creations;
		if (creations >= 3) {
			error(429, 'Please try the demo later');
		}
		await tx
			.update(demoClientThrottle)
			.set({
				windowStartedAt: creations === 0 ? now : throttle.windowStartedAt,
				creations: creations + 1,
			})
			.where(eq(demoClientThrottle.clientHash, fingerprint));
		await tx.execute(sql`select pg_advisory_xact_lock(433)`);
		const [{ count }] = await tx.select({ count: sql<number>`count(*)` }).from(demoSession);
		if (Number(count) >= 500) {
			error(503, 'Demo is temporarily unavailable');
		}
		await tx.insert(demoSession).values({
			id,
			tokenHash: digest(token),
			viewerUserId,
			clientHash: fingerprint,
			createdAt: now,
			expiresAt,
		});
		await tx.insert(user).values({
			id: viewerUserId,
			name: 'Tereza Novotná',
			email: `${viewerUserId}@demo.invalid`,
			demoSessionId: id,
		});
		await provisionDemoCatalog(tx, id, viewerUserId, locale, now);
	});
	event.cookies.set(DEMO_COOKIE, token, {
		path: '/',
		httpOnly: true,
		secure: !import.meta.env.DEV,
		sameSite: 'lax',
		maxAge: (LIFETIME_MS / 1000) * 2,
	});
	return { id, viewerUserId, expiresAt };
}

export async function resetDemo(sessionId: string, locale: 'cs' | 'en') {
	await getDb().transaction(async (tx) => {
		const [session] = await tx
			.select()
			.from(demoSession)
			.where(eq(demoSession.id, sessionId))
			.for('update');
		if (!session || session.expiresAt <= new Date()) {
			error(410, 'Demo has expired');
		}
		await deleteDemoReservations(tx, [session.id]);
		await tx.delete(wishlist).where(eq(wishlist.demoSessionId, session.id));
		await tx
			.delete(user)
			.where(
				and(eq(user.demoSessionId, session.id), sql`${user.id} <> ${session.viewerUserId}`),
			);
		await provisionDemoCatalog(tx, session.id, session.viewerUserId, locale, new Date());
	});
}
