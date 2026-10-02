import { describe, expect, it, vi, afterAll } from 'vitest';
import { createHash } from 'node:crypto';
import { eq, and, count } from 'drizzle-orm';

const databaseUrl = process.env.DEMO_TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? '';
const parsedUrl = (() => {
	try {
		return new URL(databaseUrl);
	} catch {
		return null;
	}
})();
const isolatedDatabase =
	process.env.DEMO_TEST_ISOLATED_DATABASE === '1' &&
	parsedUrl !== null &&
	['localhost', '127.0.0.1', '::1'].includes(parsedUrl.hostname) &&
	parsedUrl.pathname !== '/local' &&
	parsedUrl.pathname.length > 1;
vi.mock('$env/dynamic/private', () => ({
	env: {
		DATABASE_URL: process.env.DEMO_TEST_DATABASE_URL ?? process.env.DATABASE_URL,
		AUTH_SECRET: 'demo-test-auth-secret-0000000000000000',
		ORIGIN: 'http://localhost:8337',
	},
}));
vi.mock('$app/server', () => ({ getRequestEvent: vi.fn() }));

import { getRequestEvent } from '$app/server';
import { getDb, closeDb } from '$lib/server/db/index.js';
import { demoClientThrottle, demoSession, user } from '$lib/server/db/auth.schema.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { gift, reservation } from '$lib/server/db/gift.schema.js';
import {
	createDemo,
	findDemoSession,
	resetDemo,
	cleanExpiredDemos,
	DEMO_COOKIE,
} from './session.js';
import { assertWishlistScope, wishlistScope } from './scope.js';
import { verifyManagerAccess } from '$lib/modules/wishlists/wishlist_access.js';
import { demoHandle } from '../../../hooks.server.js';
import { createAuth } from '$lib/server/auth.js';
import { drizzleGiftIngestionStore } from '$lib/modules/ingestion/ingestion_store.js';

const createdSessions: string[] = [];
const realUserId = `demo-test-real-${Date.now()}`;

function visitor(address: string) {
	const values = new Map<string, string>();
	return {
		request: new Request('http://localhost/demo/start'),
		getClientAddress: () => address,
		cookies: {
			get: (name: string) => values.get(name),
			set: (name: string, value: string) => values.set(name, value),
			delete: (name: string) => values.delete(name),
		},
	};
}

// Only the explicitly isolated, separately migrated verification database may run this test.
describe.skipIf(!isolatedDatabase)('demo isolation and retention [isolated DB]', () => {
	afterAll(async () => {
		for (const id of createdSessions) {
			await getDb().delete(demoSession).where(eq(demoSession.id, id));
		}
		await getDb().delete(user).where(eq(user.id, realUserId));
		for (const address of ['127.0.0.11', '127.0.0.12']) {
			await getDb()
				.delete(demoClientThrottle)
				.where(
					eq(
						demoClientThrottle.clientHash,
						createHash('sha256').update(address).digest('hex'),
					),
				);
		}
		await closeDb();
	});

	it('provisions independent visitors, protects real data, resets only one and preserves fixed expiry', async () => {
		const first = visitor('127.0.0.11');
		const second = visitor('127.0.0.12');
		const sessionA = await createDemo(
			first as unknown as Parameters<typeof createDemo>[0],
			'cs',
		);
		createdSessions.push(sessionA.id);
		const sessionB = await createDemo(
			second as unknown as Parameters<typeof createDemo>[0],
			'en',
		);
		createdSessions.push(sessionB.id);
		await getDb()
			.insert(user)
			.values({ id: realUserId, name: 'Real', email: `${realUserId}@example.invalid` });
		const [realWishlist] = await getDb()
			.insert(wishlist)
			.values({ recipientUserId: realUserId, title: 'Private real list' })
			.returning();
		try {
			const rowsA = await getDb()
				.select()
				.from(wishlist)
				.where(eq(wishlist.demoSessionId, sessionA.id));
			const rowsB = await getDb()
				.select()
				.from(wishlist)
				.where(eq(wishlist.demoSessionId, sessionB.id));
			expect(rowsA).toHaveLength(8);
			expect(rowsB).toHaveLength(8);
			expect(
				rowsA.filter((row) => row.recipientUserId === sessionA.viewerUserId),
			).toHaveLength(3);
			const [giftCount] = await getDb()
				.select({ value: count() })
				.from(gift)
				.where(eq(gift.wishlistId, rowsA[0]!.id));
			expect(giftCount?.value).toBe(15);
			const archived = rowsA.find((row) => row.status === 'archived');
			expect(archived?.eventDate?.getTime()).toBeLessThan(Date.now());
			const reservations = await getDb()
				.select({ userId: reservation.userId, wishlistId: gift.wishlistId })
				.from(reservation)
				.innerJoin(gift, eq(reservation.giftId, gift.id))
				.innerJoin(wishlist, eq(gift.wishlistId, wishlist.id))
				.where(eq(wishlist.demoSessionId, sessionA.id));
			expect(reservations.some((row) => row.userId === sessionA.viewerUserId)).toBe(true);
			expect(
				reservations
					.filter((row) => row.userId === sessionA.viewerUserId)
					.every(
						(row) =>
							rowsA.find((list) => list.id === row.wishlistId)?.recipientUserId !==
							sessionA.viewerUserId,
					),
			).toBe(true);
			vi.mocked(getRequestEvent).mockReturnValue({
				locals: { demoSession: { id: sessionA.id } },
			} as ReturnType<typeof getRequestEvent>);
			expect(() => assertWishlistScope(rowsA[0]!)).not.toThrow();
			expect(() => assertWishlistScope(rowsB[0]!)).toThrow();
			expect(() => assertWishlistScope(realWishlist!)).toThrow();
			expect(
				await drizzleGiftIngestionStore.resolveTarget(undefined, rowsA[0]!.shortId),
			).toBeNull();
			expect(
				await drizzleGiftIngestionStore.resolveTarget(undefined, realWishlist!.shortId),
			).not.toBeNull();
			await expect(
				verifyManagerAccess(sessionA.viewerUserId, rowsA[0]!.id),
			).resolves.toBeDefined();
			await expect(
				verifyManagerAccess(sessionA.viewerUserId, rowsB[0]!.id),
			).rejects.toBeDefined();
			await expect(
				verifyManagerAccess(sessionA.viewerUserId, realWishlist!.id),
			).rejects.toBeDefined();
			const followed = rowsA.find(
				(row) =>
					row.recipientUserId !== sessionA.viewerUserId && row.recipientUserId !== null,
			)!;
			await expect(
				verifyManagerAccess(sessionA.viewerUserId, followed.id),
			).rejects.toBeDefined();
			await resetDemo(sessionA.id, 'en');
			const [sameSession] = await getDb()
				.select()
				.from(demoSession)
				.where(eq(demoSession.id, sessionA.id));
			expect(sameSession?.expiresAt).toEqual(sessionA.expiresAt);
			const [newList] = await getDb()
				.select()
				.from(wishlist)
				.where(eq(wishlist.demoSessionId, sessionA.id))
				.limit(1);
			expect(newList?.id).not.toBe(rowsA[0]!.id);
			expect(
				await getDb()
					.select()
					.from(wishlist)
					.where(eq(wishlist.demoSessionId, sessionB.id)),
			).toHaveLength(8);
			expect(first.cookies.get(DEMO_COOKIE)).toMatch(/^[a-f0-9]{64}$/);
			expect(await findDemoSession(first.cookies.get(DEMO_COOKIE)!)).toMatchObject({
				id: sessionA.id,
			});
			await getDb()
				.update(demoSession)
				.set({ expiresAt: new Date(Date.now() - 1) })
				.where(eq(demoSession.id, sessionA.id));
			expect(await findDemoSession(first.cookies.get(DEMO_COOKIE)!)).toBeNull();
			const expiredLanding = {
				...first,
				url: new URL('http://localhost/en'),
				request: new Request('http://localhost/en', { headers: { Accept: 'text/html' } }),
				locals: {},
				isRemoteRequest: false,
			};
			await expect(
				demoHandle({
					event: expiredLanding,
					resolve: async () => new Response('unexpected'),
				} as unknown as Parameters<typeof demoHandle>[0]),
			).rejects.toMatchObject({
				status: 303,
				location: '/en/demo',
			});
			const dataRequest = {
				...expiredLanding,
				url: new URL('http://localhost/en/home/__data.json'),
				request: new Request('http://localhost/en/home/__data.json'),
				isDataRequest: true,
			};
			let resolvedExpiredRequest = false;
			await expect(
				demoHandle({
					event: dataRequest,
					resolve: async () => {
						resolvedExpiredRequest = true;
						return new Response('private data');
					},
				} as unknown as Parameters<typeof demoHandle>[0]),
			).rejects.toMatchObject({ status: 303, location: '/en/demo' });
			expect(resolvedExpiredRequest).toBe(false);
			const expiredRemote = {
				...dataRequest,
				url: new URL('http://localhost/en/w/test'),
				isDataRequest: false,
				isRemoteRequest: true,
				request: new Request('http://localhost/en/w/test', { method: 'POST' }),
			};
			await expect(
				demoHandle({
					event: expiredRemote,
					resolve: async () => {
						resolvedExpiredRequest = true;
						return new Response('unexpected');
					},
				} as unknown as Parameters<typeof demoHandle>[0]),
			).rejects.toMatchObject({ status: 410 });
			expect(resolvedExpiredRequest).toBe(false);
			await cleanExpiredDemos();
			expect(
				await getDb()
					.select()
					.from(wishlist)
					.where(eq(wishlist.demoSessionId, sessionA.id)),
			).toHaveLength(0);
			expect(
				await getDb().select().from(wishlist).where(eq(wishlist.id, realWishlist!.id)),
			).toHaveLength(1);
		} finally {
			await getDb().delete(wishlist).where(eq(wishlist.id, realWishlist!.id));
		}
	});

	it('rejects parsed reserved identities at the auth API boundary', async () => {
		const request = new Request('http://localhost:8337/api/auth/send-verification-email', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:8337' },
			body: JSON.stringify({
				email: 'visitor@demo．invalid',
				callbackURL: 'http://localhost:8337/',
			}),
		});
		const response = await createAuth().handler(request);
		expect(response.status).toBe(403);
		expect(await response.text()).toContain('Demo identities cannot authenticate');
	});

	it('routes reads and writes through a session-locked transaction and rejects other routes', async () => {
		const first = visitor('127.0.0.11');
		const second = visitor('127.0.0.12');
		const sessionA = await createDemo(
			first as unknown as Parameters<typeof createDemo>[0],
			'cs',
		);
		const sessionB = await createDemo(
			second as unknown as Parameters<typeof createDemo>[0],
			'en',
		);
		createdSessions.push(sessionA.id, sessionB.id);
		const [foreign] = await getDb()
			.select()
			.from(wishlist)
			.where(eq(wishlist.demoSessionId, sessionB.id))
			.limit(1);
		const event = {
			...first,
			url: new URL('http://localhost/home'),
			locals: {},
			isRemoteRequest: false,
		} as unknown as Parameters<Parameters<typeof demoHandle>[0]['resolve']>[0];
		vi.mocked(getRequestEvent).mockReturnValue(event as ReturnType<typeof getRequestEvent>);
		let resolved = false;
		const response = await demoHandle({
			event,
			resolve: async (request) => {
				resolved = true;
				const rows = await getDb(request).select().from(wishlist).where(wishlistScope());
				expect(rows).toHaveLength(8);
				expect(rows.every((row) => row.demoSessionId === sessionA.id)).toBe(true);
				const changed = await getDb(request)
					.update(wishlist)
					.set({ title: 'Crossed' })
					.where(and(eq(wishlist.id, foreign!.id), wishlistScope()))
					.returning();
				expect(changed).toHaveLength(0);
				return new Response('OK');
			},
		} as Parameters<typeof demoHandle>[0]);
		expect(response.status).toBe(200);
		expect(resolved).toBe(true);
		expect(event.locals).not.toHaveProperty('demoDatabaseTransaction');
		for (const [landing, home] of [
			['/', '/home'],
			['/en', '/en/home'],
			['/en/', '/en/home'],
		]) {
			const landingEvent = {
				...event,
				url: new URL(`http://localhost${landing}`),
				request: new Request(`http://localhost${landing}`, {
					headers: { Accept: 'text/html' },
				}),
				locals: {},
			};
			await expect(
				demoHandle({
					event: landingEvent,
					resolve: async () => new Response('unexpected'),
				} as Parameters<typeof demoHandle>[0]),
			).rejects.toMatchObject({
				status: 303,
				location: home,
			});
		}
		const denied = {
			...event,
			url: new URL('http://localhost/api/internal/v1/gift-ingestion'),
			locals: {},
		};
		await expect(
			demoHandle({
				event: denied,
				resolve: async () => new Response('unexpected'),
			} as Parameters<typeof demoHandle>[0]),
		).rejects.toBeDefined();
		const forgedLanding = {
			...event,
			url: new URL('http://localhost/'),
			request: new Request('http://localhost/_app/remote/forged'),
			isRemoteRequest: true,
		};
		await expect(
			demoHandle({
				event: forgedLanding,
				resolve: async () => new Response('unexpected'),
			} as Parameters<typeof demoHandle>[0]),
		).rejects.toMatchObject({ status: 403 });
		const forged = {
			...event,
			url: new URL('http://localhost/demo/exit'),
			request: new Request('http://localhost/_app/remote/forged'),
			isRemoteRequest: true,
		};
		await expect(
			demoHandle({
				event: forged,
				resolve: async () => new Response('unexpected'),
			} as Parameters<typeof demoHandle>[0]),
		).rejects.toBeDefined();
	});
});
