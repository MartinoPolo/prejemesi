import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { eq, and, count, inArray } from 'drizzle-orm';
import { resolveIsolatedDemoTestDatabaseUrl } from './isolated_test_database.js';

vi.mock('$env/dynamic/private', () => ({
	env: {
		DATABASE_URL: process.env.DEMO_TEST_DATABASE_URL,
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
import { moderatorInvite } from '$lib/server/db/moderator.schema.js';
import { notification } from '$lib/server/db/notification.schema.js';
import { NOTIFICATION_TYPE } from '$lib/modules/notifications/types.js';
import { createDemo, findDemoSession, resetDemo, cleanExpiredDemos } from './session.js';
import {
	DEMO_CLIENT_WINDOW_MS,
	DEMO_COOKIE_NAME,
	DEMO_CREATIONS_PER_CLIENT_WINDOW,
	DEMO_EDIT_REQUEST_LIMIT,
	DEMO_RESET_LIMIT,
} from './constants.js';
import { getDemoCatalog } from './catalog.js';
import { assertWishlistScope, wishlistScope } from './scope.js';
import { verifyManagerAccess } from '$lib/modules/wishlists/wishlist_access.js';
import { demoHandle } from '../../../hooks.server.js';
import { createAuth } from '$lib/server/auth.js';
import { drizzleGiftIngestionStore } from '$lib/modules/ingestion/ingestion_store.js';

// Only the explicitly isolated, separately migrated verification database may run this suite.
const isolatedDatabaseUrl = resolveIsolatedDemoTestDatabaseUrl('DEMO_TEST_DATABASE_URL', {
	allowSharedDevelopmentDatabase: false,
});

const DATABASE_SUITE_TIMEOUT_MS = 120_000;
const createdSessions: string[] = [];
const runSuffix = Date.now();
const realUserId = `demo-test-real-${runSuffix}`;
const staleClientHash = createHash('sha256').update(`stale-client-${runSuffix}`).digest('hex');
const clientAddresses = ['127.0.0.11', '127.0.0.12', '127.0.0.13', '127.0.0.14', '127.0.0.15'];

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

function clientHash(address: string): string {
	return createHash('sha256').update(address).digest('hex');
}

async function createVisitorDemo(
	address: string,
	locale: 'cs' | 'en',
): Promise<{ session: Awaited<ReturnType<typeof createDemo>>; owner: ReturnType<typeof visitor> }> {
	const owner = visitor(address);
	const session = await createDemo(owner as unknown as Parameters<typeof createDemo>[0], locale);
	createdSessions.push(session.id);
	return { session, owner };
}

function thrownBy(operation: () => void): unknown {
	try {
		operation();
	} catch (failure) {
		return failure;
	}
	throw new Error('Expected the operation to throw');
}

async function playgroundRecords(sessionId: string) {
	const lists = await getDb()
		.select({ id: wishlist.id })
		.from(wishlist)
		.where(eq(wishlist.demoSessionId, sessionId));
	const listIds = lists.map(({ id }) => id);
	const gifts =
		listIds.length === 0
			? []
			: await getDb()
					.select({ id: gift.id })
					.from(gift)
					.where(inArray(gift.wishlistId, listIds));
	const giftIds = gifts.map(({ id }) => id);
	const reservations =
		giftIds.length === 0
			? []
			: await getDb()
					.select({ id: reservation.id })
					.from(reservation)
					.where(inArray(reservation.giftId, giftIds));
	const users = await getDb()
		.select({ id: user.id })
		.from(user)
		.where(eq(user.demoSessionId, sessionId));
	return {
		wishlistIds: listIds.sort(),
		giftIds: giftIds.sort(),
		reservationIds: reservations.map(({ id }) => id).sort(),
		userIds: users.map(({ id }) => id).sort(),
	};
}

let sessionA: Awaited<ReturnType<typeof createDemo>>;
let sessionB: Awaited<ReturnType<typeof createDemo>>;
let ownerA: ReturnType<typeof visitor>;
let realWishlist: typeof wishlist.$inferSelect;
let realGiftId: string;
let realReservationId: string;

describe.skipIf(isolatedDatabaseUrl === null)(
	'demo isolation and retention [isolated DB]',
	{ timeout: DATABASE_SUITE_TIMEOUT_MS },
	() => {
		beforeAll(async () => {
			// A crashed earlier run must not leave these addresses throttled.
			await getDb()
				.delete(demoClientThrottle)
				.where(inArray(demoClientThrottle.clientHash, clientAddresses.map(clientHash)));
			({ session: sessionA, owner: ownerA } = await createVisitorDemo(
				clientAddresses[0]!,
				'cs',
			));
			({ session: sessionB } = await createVisitorDemo(clientAddresses[1]!, 'en'));
			await getDb()
				.insert(user)
				.values({ id: realUserId, name: 'Real', email: `${realUserId}@example.invalid` });
			[realWishlist] = (await getDb()
				.insert(wishlist)
				.values({ recipientUserId: realUserId, title: 'Private real list' })
				.returning()) as [typeof wishlist.$inferSelect];
			const [realGift] = await getDb()
				.insert(gift)
				.values({ wishlistId: realWishlist.id, name: 'Private gift' })
				.returning();
			realGiftId = realGift!.id;
			const [realReservation] = await getDb()
				.insert(reservation)
				.values({ giftId: realGiftId, userId: realUserId })
				.returning();
			realReservationId = realReservation!.id;
		}, DATABASE_SUITE_TIMEOUT_MS);

		afterAll(async () => {
			for (const id of createdSessions) {
				const { giftIds } = await playgroundRecords(id);
				if (giftIds.length > 0) {
					await getDb().delete(reservation).where(inArray(reservation.giftId, giftIds));
				}
				await getDb().delete(demoSession).where(eq(demoSession.id, id));
			}
			if (realWishlist !== undefined) {
				await getDb().delete(wishlist).where(eq(wishlist.id, realWishlist.id));
			}
			await getDb().delete(user).where(eq(user.id, realUserId));
			await getDb()
				.delete(demoClientThrottle)
				.where(
					inArray(demoClientThrottle.clientHash, [
						...clientAddresses.map(clientHash),
						staleClientHash,
					]),
				);
			await closeDb();
		}, DATABASE_SUITE_TIMEOUT_MS);

		it('provisions eight curated wishlists of fifteen gifts for each visitor', async () => {
			for (const session of [sessionA, sessionB]) {
				const rows = await getDb()
					.select()
					.from(wishlist)
					.where(eq(wishlist.demoSessionId, session.id));
				expect(rows).toHaveLength(8);
				expect(
					rows.filter((row) => row.recipientUserId === session.viewerUserId),
				).toHaveLength(3);
				expect(rows.filter((row) => row.recipientUserId === null)).toHaveLength(2);
				expect(rows.filter((row) => row.status === 'draft')).toHaveLength(1);
				const archived = rows.filter((row) => row.status === 'archived');
				expect(archived).toHaveLength(1);
				expect(archived[0]!.eventDate?.getTime()).toBeLessThan(Date.now());
				const giftCounts = await getDb()
					.select({ wishlistId: gift.wishlistId, value: count() })
					.from(gift)
					.where(
						inArray(
							gift.wishlistId,
							rows.map((row) => row.id),
						),
					)
					.groupBy(gift.wishlistId);
				expect(giftCounts).toHaveLength(8);
				expect(giftCounts.every((row) => row.value === 15)).toBe(true);
			}
			const listsA = await getDb()
				.select()
				.from(wishlist)
				.where(eq(wishlist.demoSessionId, sessionA.id));
			const viewerReservations = await getDb()
				.select({ wishlistId: gift.wishlistId })
				.from(reservation)
				.innerJoin(gift, eq(reservation.giftId, gift.id))
				.where(
					and(
						eq(reservation.userId, sessionA.viewerUserId),
						inArray(
							gift.wishlistId,
							listsA.map((row) => row.id),
						),
					),
				);
			expect(viewerReservations.length).toBeGreaterThan(0);
			expect(
				viewerReservations.every(
					(row) =>
						listsA.find((list) => list.id === row.wishlistId)?.recipientUserId !==
						sessionA.viewerUserId,
				),
			).toBe(true);
		});

		it('keeps other playgrounds and real wishlists outside the visitor scope', async () => {
			const [listA] = await getDb()
				.select()
				.from(wishlist)
				.where(and(eq(wishlist.demoSessionId, sessionA.id), eq(wishlist.status, 'active')))
				.limit(1);
			const [listB] = await getDb()
				.select()
				.from(wishlist)
				.where(eq(wishlist.demoSessionId, sessionB.id))
				.limit(1);
			vi.mocked(getRequestEvent).mockReturnValue({
				locals: { demoSession: { id: sessionA.id } },
			} as ReturnType<typeof getRequestEvent>);
			expect(() => assertWishlistScope(listA!)).not.toThrow();
			expect(thrownBy(() => assertWishlistScope(listB!))).toMatchObject({ status: 404 });
			expect(thrownBy(() => assertWishlistScope(realWishlist))).toMatchObject({
				status: 404,
			});
			expect(
				await drizzleGiftIngestionStore.resolveTarget(undefined, listA!.shortId),
			).toBeNull();
			expect(
				await drizzleGiftIngestionStore.resolveTarget(undefined, realWishlist.shortId),
			).not.toBeNull();
			await expect(
				verifyManagerAccess(sessionA.viewerUserId, listA!.id),
			).resolves.toMatchObject({ wishlistRow: { id: listA!.id } });
			await expect(
				verifyManagerAccess(sessionA.viewerUserId, listB!.id),
			).rejects.toMatchObject({ status: 404 });
			await expect(
				verifyManagerAccess(sessionA.viewerUserId, realWishlist.id),
			).rejects.toMatchObject({ status: 404 });
			const [followed] = await getDb()
				.select()
				.from(wishlist)
				.where(eq(wishlist.demoSessionId, sessionA.id))
				.then((rows) =>
					rows.filter(
						(row) =>
							row.recipientUserId !== sessionA.viewerUserId &&
							row.recipientUserId !== null,
					),
				);
			await expect(
				verifyManagerAccess(sessionA.viewerUserId, followed!.id),
			).rejects.toMatchObject({ status: 403 });
		});

		it('routes reads and writes through a session-locked transaction without extending expiry', async () => {
			const [foreign] = await getDb()
				.select()
				.from(wishlist)
				.where(eq(wishlist.demoSessionId, sessionB.id))
				.limit(1);
			const event = {
				...ownerA,
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
					const rows = await getDb(request)
						.select()
						.from(wishlist)
						.where(wishlistScope());
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

			const editEvent = {
				...ownerA,
				url: new URL('http://localhost/home'),
				request: new Request('http://localhost/home', { method: 'POST' }),
				locals: {},
				isRemoteRequest: false,
			} as unknown as Parameters<typeof demoHandle>[0]['event'];
			vi.mocked(getRequestEvent).mockReturnValue(editEvent);
			const editResponse = await demoHandle({
				event: editEvent,
				resolve: async () => new Response('OK'),
			} as Parameters<typeof demoHandle>[0]);
			expect(editResponse.status).toBe(200);
			const [afterActivity] = await getDb()
				.select({ expiresAt: demoSession.expiresAt })
				.from(demoSession)
				.where(eq(demoSession.id, sessionA.id));
			expect(afterActivity?.expiresAt).toEqual(sessionA.expiresAt);

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
				).rejects.toMatchObject({ status: 303, location: home });
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
			).rejects.toMatchObject({ status: 403 });
			for (const forgedPath of ['/', '/demo/exit']) {
				const forged = {
					...event,
					url: new URL(`http://localhost${forgedPath}`),
					request: new Request('http://localhost/_app/remote/forged'),
					isRemoteRequest: true,
				};
				await expect(
					demoHandle({
						event: forged,
						resolve: async () => new Response('unexpected'),
					} as Parameters<typeof demoHandle>[0]),
				).rejects.toMatchObject({ status: 403 });
			}
		});

		it('resets one playground to the chosen catalog language without extending expiry', async () => {
			const before = await playgroundRecords(sessionA.id);
			const otherBefore = await playgroundRecords(sessionB.id);
			await resetDemo(sessionA.id, 'en');
			const [sameSession] = await getDb()
				.select()
				.from(demoSession)
				.where(eq(demoSession.id, sessionA.id));
			expect(sameSession?.expiresAt).toEqual(sessionA.expiresAt);
			const after = await playgroundRecords(sessionA.id);
			expect(after.wishlistIds).toHaveLength(8);
			expect(after.wishlistIds.some((id) => before.wishlistIds.includes(id))).toBe(false);
			const titles = await getDb()
				.select({ title: wishlist.title })
				.from(wishlist)
				.where(eq(wishlist.demoSessionId, sessionA.id));
			expect(new Set(titles.map(({ title }) => title))).toEqual(
				new Set(getDemoCatalog('en').map(({ title }) => title)),
			);
			expect(await playgroundRecords(sessionB.id)).toEqual(otherBefore);
			expect(
				await getDb().select().from(wishlist).where(eq(wishlist.id, realWishlist.id)),
			).toHaveLength(1);
			expect(ownerA.cookies.get(DEMO_COOKIE_NAME)).toMatch(/^[a-f0-9]{64}$/);
			expect(await findDemoSession(ownerA.cookies.get(DEMO_COOKIE_NAME)!)).toMatchObject({
				id: sessionA.id,
			});
		});

		it('denies expired playgrounds, then cleanup removes only expired demo records', async () => {
			const { session: expired, owner: expiredOwner } = await createVisitorDemo(
				clientAddresses[3]!,
				'cs',
			);
			const expiredRecords = await playgroundRecords(expired.id);
			expect(expiredRecords.reservationIds.length).toBeGreaterThan(0);
			expect(expiredRecords.userIds.length).toBeGreaterThan(1);
			const survivingRecords = await playgroundRecords(sessionB.id);
			await getDb()
				.update(demoSession)
				.set({ expiresAt: new Date(Date.now() - 1) })
				.where(eq(demoSession.id, expired.id));
			const expiredToken = expiredOwner.cookies.get(DEMO_COOKIE_NAME)!;
			expect(await findDemoSession(expiredToken)).toBeNull();

			const expiredLanding = {
				...expiredOwner,
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
			).rejects.toMatchObject({ status: 303, location: '/en/demo' });
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
			const expiredRemote = {
				...dataRequest,
				url: new URL('http://localhost/en/my-lists'),
				isDataRequest: false,
				isRemoteRequest: true,
				request: new Request('http://localhost/en/my-lists', { method: 'POST' }),
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
			await expect(resetDemo(expired.id, 'cs')).rejects.toMatchObject({ status: 410 });

			await getDb()
				.insert(demoClientThrottle)
				.values({
					clientHash: staleClientHash,
					windowStartedAt: new Date(Date.now() - DEMO_CLIENT_WINDOW_MS * 3),
					creations: 1,
				});
			// Rows referencing demo records without a cascade must not stall the sweep.
			await getDb().insert(moderatorInvite).values({
				wishlistId: expiredRecords.wishlistIds[0]!,
				createdByUserId: expiredRecords.userIds[0]!,
			});
			const [realNotification] = await getDb()
				.insert(notification)
				.values({
					userId: realUserId,
					type: NOTIFICATION_TYPE.WISHLIST_ARCHIVED,
					actorId: expiredRecords.userIds[0]!,
				})
				.returning({ id: notification.id });
			// Cleanup works in bounded batches, so older leftovers may need several passes.
			for (let pass = 0; pass < 20; pass += 1) {
				await cleanExpiredDemos();
				const [remainingSession] = await getDb()
					.select({ id: demoSession.id })
					.from(demoSession)
					.where(eq(demoSession.id, expired.id));
				const [remainingThrottle] = await getDb()
					.select({ clientHash: demoClientThrottle.clientHash })
					.from(demoClientThrottle)
					.where(eq(demoClientThrottle.clientHash, staleClientHash));
				if (remainingSession === undefined && remainingThrottle === undefined) {
					break;
				}
			}

			expect(
				await getDb().select().from(demoSession).where(eq(demoSession.id, expired.id)),
			).toHaveLength(0);
			expect(
				await getDb().select().from(user).where(inArray(user.id, expiredRecords.userIds)),
			).toHaveLength(0);
			expect(
				await getDb()
					.select()
					.from(wishlist)
					.where(inArray(wishlist.id, expiredRecords.wishlistIds)),
			).toHaveLength(0);
			expect(
				await getDb().select().from(gift).where(inArray(gift.id, expiredRecords.giftIds)),
			).toHaveLength(0);
			expect(
				await getDb()
					.select()
					.from(reservation)
					.where(inArray(reservation.id, expiredRecords.reservationIds)),
			).toHaveLength(0);
			expect(
				await getDb()
					.select()
					.from(demoClientThrottle)
					.where(eq(demoClientThrottle.clientHash, staleClientHash)),
			).toHaveLength(0);
			expect(
				await getDb()
					.select()
					.from(demoClientThrottle)
					.where(eq(demoClientThrottle.clientHash, clientHash(clientAddresses[3]!))),
			).toHaveLength(1);

			expect(
				await getDb().select().from(demoSession).where(eq(demoSession.id, sessionB.id)),
			).toHaveLength(1);
			expect(await playgroundRecords(sessionB.id)).toEqual(survivingRecords);
			expect(await getDb().select().from(user).where(eq(user.id, realUserId))).toHaveLength(
				1,
			);
			expect(
				await getDb().select().from(wishlist).where(eq(wishlist.id, realWishlist.id)),
			).toHaveLength(1);
			expect(await getDb().select().from(gift).where(eq(gift.id, realGiftId))).toHaveLength(
				1,
			);
			expect(
				await getDb()
					.select()
					.from(reservation)
					.where(eq(reservation.id, realReservationId)),
			).toHaveLength(1);
			expect(
				await getDb()
					.select({ actorId: notification.actorId })
					.from(notification)
					.where(eq(notification.id, realNotification!.id)),
			).toEqual([{ actorId: null }]);
		});

		it('limits playground creation per client within the fixed window', async () => {
			const address = clientAddresses[4]!;
			await getDb()
				.insert(demoClientThrottle)
				.values({
					clientHash: clientHash(address),
					windowStartedAt: new Date(),
					creations: DEMO_CREATIONS_PER_CLIENT_WINDOW - 1,
				});
			await createVisitorDemo(address, 'cs');
			const rejected = visitor(address);
			await expect(
				createDemo(rejected as unknown as Parameters<typeof createDemo>[0], 'cs'),
			).rejects.toMatchObject({ status: 429 });
			expect(rejected.cookies.get(DEMO_COOKIE_NAME)).toBeUndefined();
			expect(
				await getDb()
					.select()
					.from(demoSession)
					.where(eq(demoSession.clientHash, clientHash(address))),
			).toHaveLength(1);
			const [throttle] = await getDb()
				.select({ creations: demoClientThrottle.creations })
				.from(demoClientThrottle)
				.where(eq(demoClientThrottle.clientHash, clientHash(address)));
			expect(throttle?.creations).toBe(DEMO_CREATIONS_PER_CLIENT_WINDOW);
		});

		it('rejects parsed reserved identities at the auth API boundary', async () => {
			const request = new Request('http://localhost:8337/api/auth/send-verification-email', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Origin: 'http://localhost:8337',
				},
				body: JSON.stringify({
					email: 'visitor@demo．invalid',
					callbackURL: 'http://localhost:8337/',
				}),
			});
			const response = await createAuth().handler(request);
			expect(response.status).toBe(403);
			expect(await response.text()).toContain('Demo identities cannot authenticate');
		});

		it('resolves stale demo cookies normally and keeps edit charges of failed requests', async () => {
			type DemoHandleEvent = Parameters<typeof demoHandle>[0]['event'];
			const { session: expired, owner: expiredVisitor } = await createVisitorDemo(
				clientAddresses[2]!,
				'cs',
			);
			const { session: live, owner: liveVisitor } = await createVisitorDemo(
				clientAddresses[2]!,
				'cs',
			);
			await getDb()
				.update(demoSession)
				.set({ expiresAt: new Date(Date.now() - 1) })
				.where(eq(demoSession.id, expired.id));

			function requestEvent(
				cookieOwner: ReturnType<typeof visitor>,
				path: string,
				init: { method?: string; accept?: string } = {},
			) {
				const url = new URL(`http://localhost${path}`);
				const event = {
					...cookieOwner,
					url,
					request: new Request(url, {
						method: init.method ?? 'GET',
						headers: init.accept === undefined ? {} : { Accept: init.accept },
					}),
					locals: {},
					isDataRequest: false,
					isRemoteRequest: false,
				} as unknown as DemoHandleEvent;
				vi.mocked(getRequestEvent).mockReturnValue(
					event as ReturnType<typeof getRequestEvent>,
				);
				return event;
			}
			async function handleWith(event: DemoHandleEvent, status = 200) {
				let resolved = false;
				const response = await demoHandle({
					event,
					resolve: async () => {
						resolved = true;
						return new Response('resolved', { status });
					},
				} as Parameters<typeof demoHandle>[0]);
				return { response, resolved };
			}
			async function counters(sessionId: string) {
				const [row] = await getDb()
					.select({ editRequests: demoSession.editRequests, resets: demoSession.resets })
					.from(demoSession)
					.where(eq(demoSession.id, sessionId));
				return row;
			}

			for (const staleToken of ['f'.repeat(64), 'not-a-demo-token']) {
				const unknownVisitor = visitor(clientAddresses[2]!);
				unknownVisitor.cookies.set(DEMO_COOKIE_NAME, staleToken);
				const { response, resolved } = await handleWith(
					requestEvent(unknownVisitor, '/login', { accept: 'text/html' }),
				);
				expect(resolved).toBe(true);
				expect(response.status).toBe(200);
				expect(unknownVisitor.cookies.get(DEMO_COOKIE_NAME)).toBeUndefined();
			}

			const expiredToken = expiredVisitor.cookies.get(DEMO_COOKIE_NAME)!;
			await expect(
				handleWith(requestEvent(expiredVisitor, '/home', { accept: 'text/html' })),
			).rejects.toMatchObject({ status: 303, location: '/demo' });
			for (const path of ['/login', '/register', '/w/shared-list', '/api/auth/get-session']) {
				expiredVisitor.cookies.set(DEMO_COOKIE_NAME, expiredToken);
				const event = requestEvent(expiredVisitor, path, { accept: 'text/html' });
				const { response, resolved } = await handleWith(event);
				expect(resolved).toBe(true);
				expect(response.status).toBe(200);
				expect(event.locals.demoSession).toBeUndefined();
				expect(expiredVisitor.cookies.get(DEMO_COOKIE_NAME)).toBeUndefined();
			}

			await expect(
				handleWith(requestEvent(liveVisitor, '/login', { accept: 'text/html' })),
			).rejects.toMatchObject({ status: 303, location: '/demo' });
			await expect(
				handleWith(
					requestEvent(liveVisitor, '/api/auth/sign-in/email', { method: 'POST' }),
				),
			).rejects.toMatchObject({ status: 403 });
			expect(liveVisitor.cookies.get(DEMO_COOKIE_NAME)).toMatch(/^[a-f0-9]{64}$/);

			const failedEdit = await handleWith(
				requestEvent(liveVisitor, '/home', { method: 'POST' }),
				400,
			);
			expect(failedEdit.response.status).toBe(400);
			expect(await counters(live.id)).toEqual({ editRequests: 1, resets: 0 });
			const failedReset = await handleWith(
				requestEvent(liveVisitor, '/demo/reset', { method: 'POST' }),
				500,
			);
			expect(failedReset.response.status).toBe(500);
			expect(await counters(live.id)).toEqual({ editRequests: 2, resets: 1 });

			await getDb()
				.update(demoSession)
				.set({ editRequests: DEMO_EDIT_REQUEST_LIMIT })
				.where(eq(demoSession.id, live.id));
			let resolvedOverLimit = false;
			await expect(
				demoHandle({
					event: requestEvent(liveVisitor, '/home', { method: 'POST' }),
					resolve: async () => {
						resolvedOverLimit = true;
						return new Response('unexpected');
					},
				} as Parameters<typeof demoHandle>[0]),
			).rejects.toMatchObject({ status: 429 });
			expect(resolvedOverLimit).toBe(false);
			await getDb()
				.update(demoSession)
				.set({ editRequests: 0, resets: DEMO_RESET_LIMIT })
				.where(eq(demoSession.id, live.id));
			await expect(
				handleWith(requestEvent(liveVisitor, '/demo/reset', { method: 'POST' })),
			).rejects.toMatchObject({ status: 429 });
			expect(await counters(live.id)).toEqual({
				editRequests: 0,
				resets: DEMO_RESET_LIMIT,
			});
		});
	},
);
