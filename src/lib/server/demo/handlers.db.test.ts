import { createHash } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq, inArray, isNotNull, isNull, ne, notInArray, or } from 'drizzle-orm';
import type * as EmailModule from '$lib/server/email.js';
import { resolveIsolatedDemoTestDatabaseUrl } from './isolated_test_database.js';

// Only the explicitly isolated, separately migrated verification database may run this suite.
const isolatedDatabaseUrl = resolveIsolatedDemoTestDatabaseUrl('DEMO_TEST_DATABASE_URL', {
	allowSharedDevelopmentDatabase: false,
});

vi.mock('$env/dynamic/private', () => ({
	env: {
		DATABASE_URL: process.env.DEMO_TEST_DATABASE_URL,
		AUTH_SECRET: 'demo-test-auth-secret-0000000000000000',
	},
}));
vi.mock('$app/server', () => {
	const remote = (type: string, handler: (...arguments_: never[]) => unknown) => {
		const callable = (...arguments_: never[]) => handler(...arguments_);
		Object.assign(callable, { __: { type } });
		return callable;
	};
	return {
		getRequestEvent: vi.fn(),
		query: vi.fn((...arguments_: unknown[]) =>
			remote('query', arguments_.at(-1) as (...arguments_: never[]) => unknown),
		),
		command: vi.fn((...arguments_: unknown[]) =>
			remote('command', arguments_.at(-1) as (...arguments_: never[]) => unknown),
		),
	};
});
vi.mock('$lib/server/email.js', async (importOriginal) => ({
	...(await importOriginal<typeof EmailModule>()),
	sendEmail: vi.fn(),
}));

import { getRequestEvent } from '$app/server';
import { getDb, closeDb } from '$lib/server/db/index.js';
import { demoHandle } from '../../../hooks.server.js';
import { demoClientThrottle, demoSession, user } from '$lib/server/db/auth.schema.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { gift, reservation } from '$lib/server/db/gift.schema.js';
import { createDemo, resetDemo } from './session.js';
import { DEMO_COOKIE_NAME, DEMO_GIFT_LIMIT, DEMO_WISHLIST_LIMIT } from './constants.js';
import { preparedDemoImageUrls } from './catalog.js';
import {
	archiveWishlist,
	createWishlist,
	followWishlist,
	getWishlistByShortId,
	recordWishlistVisit,
	updateWishlist,
} from '$lib/modules/wishlists/wishlists.remote.js';
import {
	bulkCopyGifts,
	createGift,
	getBulkCopyDestinations,
	getGiftsByWishlistShortId,
	markGiftReceived,
	updateGift,
} from '$lib/modules/gifts/gifts.remote.js';
import {
	getReservationLedgerForWishlist,
	reserveGift,
	setReservationPurchased,
	unreserveGift,
} from '$lib/modules/reservations/reservations.remote.js';
import { toggleLike } from '$lib/modules/likes/likes.remote.js';
import { authorizeUpload } from '$lib/modules/uploads/uploads.remote.js';
import {
	createWishlistFromImport,
	fetchGoogleSheetCsv,
	importGifts,
} from '$lib/modules/import/import.remote.js';
import {
	acceptModeratorInvite,
	generateModeratorInviteLink,
} from '$lib/modules/moderators/moderators.remote.js';
import { acceptClaimInvite, generateClaimInviteLink } from '$lib/modules/claim/claim.remote.js';
import { claimInvite } from '$lib/server/db/claim.schema.js';
import { moderatorInvite } from '$lib/server/db/moderator.schema.js';
import { notification } from '$lib/server/db/notification.schema.js';
import { shareWishlist } from '$lib/modules/sharing/sharing.remote.js';
import {
	deleteAccount,
	refreshGoogleAvatar,
	setUserPalette,
	updateProfile,
} from '$lib/modules/settings/settings.remote.js';
import { sendEmail } from '$lib/server/email.js';
import { PALETTES, PALETTE_COOKIE_NAME } from '$lib/theme/palettes.js';

const DATABASE_SUITE_TIMEOUT_MS = 120_000;
const sessions: string[] = [];
const addresses = ['127.0.0.31', '127.0.0.32', '127.0.0.33'];
const realUserId = `handler-real-${Date.now()}`;
let realWishlistId: string;
let realShortId: string;
let realGiftId: string;
let realReservationId: string;
interface DemoViewer {
	id: string;
	viewerUserId: string;
	token: string;
}
let first: DemoViewer;
let second: DemoViewer;
let third: DemoViewer;
const writtenCookieNames: string[] = [];

function visitor(address: string) {
	const cookies = new Map<string, string>();
	return {
		request: new Request('http://localhost/demo/start'),
		getClientAddress: () => address,
		cookies: {
			get: (name: string) => cookies.get(name),
			set: (name: string, value: string) => cookies.set(name, value),
			delete: (name: string) => cookies.delete(name),
		},
	};
}

async function startDemo(address: string, locale: 'cs' | 'en'): Promise<DemoViewer> {
	const owner = visitor(address);
	const session = await createDemo(owner as unknown as Parameters<typeof createDemo>[0], locale);
	sessions.push(session.id);
	return { ...session, token: owner.cookies.get(DEMO_COOKIE_NAME)! };
}

const realSignedInLocals = () => ({
	user: { id: realUserId, name: 'Real', email: `${realUserId}@example.invalid` },
	session: { id: 'real' },
});

/**
 * Runs an operation through the demo hook as a demo visitor, the signed-in real user, or an
 * anonymous visitor. `alongsideRealSession` keeps the real sign-in while the demo cookie is active.
 */
async function asViewer<T>(
	viewer: DemoViewer | 'real' | 'anonymous',
	method: 'GET' | 'POST',
	operation: () => Promise<T> | T,
	options: { alongsideRealSession?: boolean } = {},
): Promise<T> {
	const url = new URL('http://localhost/w/fixture');
	const demoToken = typeof viewer === 'object' ? viewer.token : undefined;
	const signedInAsReal =
		viewer === 'real' || (typeof viewer === 'object' && options.alongsideRealSession === true);
	const event = {
		url,
		request: new Request(url, { method }),
		cookies: {
			get: (name: string) => (name === DEMO_COOKIE_NAME ? demoToken : undefined),
			set: (name: string) => writtenCookieNames.push(name),
			delete: () => undefined,
		},
		locals: signedInAsReal ? realSignedInLocals() : {},
		isRemoteRequest: false,
		isDataRequest: false,
	} as unknown as Parameters<typeof demoHandle>[0]['event'];
	vi.mocked(getRequestEvent).mockReturnValue(event);
	let result: T;
	const response = await demoHandle({
		event,
		resolve: async () => {
			result = await operation();
			return new Response('OK');
		},
	});
	expect(response.status).toBe(200);
	return result!;
}

async function denied(operation: () => Promise<unknown>, status: number) {
	await expect(asViewer(first, 'POST', operation)).rejects.toMatchObject({ status });
}

async function demoWishlist(
	session: DemoViewer,
	role: 'own' | 'managed' | 'followed',
	status: 'active' | 'archived' = 'active',
) {
	const roleCondition =
		role === 'own'
			? eq(wishlist.recipientUserId, session.viewerUserId)
			: role === 'managed'
				? isNull(wishlist.recipientUserId)
				: and(
						isNotNull(wishlist.recipientUserId),
						ne(wishlist.recipientUserId, session.viewerUserId),
					);
	const [row] = await getDb()
		.select()
		.from(wishlist)
		.where(
			and(eq(wishlist.demoSessionId, session.id), eq(wishlist.status, status), roleCondition),
		)
		.limit(1);
	return row!;
}

/** The curated reservation the playground viewer holds on a list they do not own. */
async function viewerReservationOn(session: DemoViewer, wishlistId: string) {
	const [row] = await getDb()
		.select({ giftId: gift.id, reservationId: reservation.id })
		.from(reservation)
		.innerJoin(gift, eq(gift.id, reservation.giftId))
		.where(
			and(
				eq(gift.wishlistId, wishlistId),
				isNull(reservation.deletedAt),
				eq(reservation.userId, session.viewerUserId),
			),
		)
		.limit(1);
	return row!;
}

/** Reserves a gift for another fictional playground person, who would be notified about edits. */
async function reserveForAnotherPlaygroundPerson(session: DemoViewer, wishlistId: string) {
	const [otherPerson] = await getDb()
		.select({ id: user.id })
		.from(user)
		.where(and(eq(user.demoSessionId, session.id), ne(user.id, session.viewerUserId)))
		.limit(1);
	const targetGift = await unreservedGift(wishlistId);
	const [created] = await getDb()
		.insert(reservation)
		.values({ giftId: targetGift.id, userId: otherPerson!.id })
		.returning();
	return { giftId: targetGift.id, reservationId: created!.id };
}

async function unreservedGift(wishlistId: string) {
	const activeReservations = getDb()
		.select({ giftId: reservation.giftId })
		.from(reservation)
		.where(isNull(reservation.deletedAt));
	const [row] = await getDb()
		.select()
		.from(gift)
		.where(
			and(
				eq(gift.wishlistId, wishlistId),
				eq(gift.received, false),
				isNull(gift.deletedAt),
				notInArray(gift.id, activeReservations),
			),
		)
		.limit(1);
	return row!;
}

async function playgroundNotificationCount(session: DemoViewer): Promise<number> {
	const playgroundUsers = getDb()
		.select({ id: user.id })
		.from(user)
		.where(eq(user.demoSessionId, session.id));
	const rows = await getDb()
		.select({ id: notification.id })
		.from(notification)
		.where(
			or(
				inArray(notification.userId, playgroundUsers),
				inArray(notification.actorId, playgroundUsers),
			),
		);
	return rows.length;
}

describe.skipIf(isolatedDatabaseUrl === null)(
	'actual demo remote handlers [isolated DB]',
	{ timeout: DATABASE_SUITE_TIMEOUT_MS },
	() => {
		beforeAll(async () => {
			// A crashed earlier run must not leave these addresses throttled.
			await getDb()
				.delete(demoClientThrottle)
				.where(
					inArray(
						demoClientThrottle.clientHash,
						addresses.map((address) =>
							createHash('sha256').update(address).digest('hex'),
						),
					),
				);
			first = await startDemo(addresses[0]!, 'cs');
			second = await startDemo(addresses[1]!, 'en');
			third = await startDemo(addresses[2]!, 'cs');
			await getDb()
				.insert(user)
				.values({ id: realUserId, name: 'Real', email: `${realUserId}@example.invalid` });
			const [realList] = await getDb()
				.insert(wishlist)
				.values({ recipientUserId: realUserId, title: 'Private real list' })
				.returning();
			realWishlistId = realList!.id;
			realShortId = realList!.shortId;
			const [realGift] = await getDb()
				.insert(gift)
				.values({ wishlistId: realWishlistId, name: 'Private gift' })
				.returning();
			realGiftId = realGift!.id;
			const [realReservation] = await getDb()
				.insert(reservation)
				.values({ giftId: realGiftId, userId: realUserId })
				.returning();
			realReservationId = realReservation!.id;
		}, DATABASE_SUITE_TIMEOUT_MS);

		beforeEach(async () => {
			// Each test exercises many commands; the per-session edit budget is covered elsewhere.
			await getDb()
				.update(demoSession)
				.set({ editRequests: 0, resets: 0 })
				.where(inArray(demoSession.id, sessions));
			writtenCookieNames.length = 0;
			vi.mocked(sendEmail).mockClear();
		});

		afterAll(async () => {
			const invitingUsers = getDb()
				.select({ id: user.id })
				.from(user)
				.where(or(inArray(user.demoSessionId, sessions), eq(user.id, realUserId)));
			await getDb()
				.delete(claimInvite)
				.where(inArray(claimInvite.createdByUserId, invitingUsers));
			await getDb()
				.delete(moderatorInvite)
				.where(inArray(moderatorInvite.createdByUserId, invitingUsers));
			for (const id of sessions) {
				const ownedLists = getDb()
					.select({ id: wishlist.id })
					.from(wishlist)
					.where(eq(wishlist.demoSessionId, id));
				const ownedGifts = getDb()
					.select({ id: gift.id })
					.from(gift)
					.where(inArray(gift.wishlistId, ownedLists));
				await getDb().delete(reservation).where(inArray(reservation.giftId, ownedGifts));
				await getDb().delete(demoSession).where(eq(demoSession.id, id));
			}
			if (realWishlistId) {
				await getDb().delete(wishlist).where(eq(wishlist.id, realWishlistId));
			}
			await getDb().delete(user).where(eq(user.id, realUserId));
			for (const address of addresses) {
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
		}, DATABASE_SUITE_TIMEOUT_MS);

		it('uses real query handlers for own, managed and followed roles without revealing protected fields', async () => {
			const lists = await getDb()
				.select()
				.from(wishlist)
				.where(eq(wishlist.demoSessionId, first.id));
			const own = lists.find(
				(row) => row.recipientUserId === first.viewerUserId && row.status === 'active',
			)!;
			const managed = lists.find(
				(row) => row.recipientUserId === null && row.status === 'active',
			)!;
			const followed = lists.find(
				(row) =>
					row.recipientUserId !== null &&
					row.recipientUserId !== first.viewerUserId &&
					row.status === 'active',
			)!;
			for (const [list, role] of [
				[own, 'recipient'],
				[managed, 'moderator'],
				[followed, 'visitor'],
			] as const) {
				const listResult = await asViewer(first, 'GET', () =>
					getWishlistByShortId(list.shortId),
				);
				const giftsResult = await asViewer(first, 'GET', () =>
					getGiftsByWishlistShortId(list.shortId),
				);
				expect(listResult.role).toBe(role);
				expect(giftsResult.role).toBe(role);
				expect(giftsResult.gifts).toHaveLength(15);
				if (role === 'recipient') {
					expect(
						giftsResult.gifts.every(
							(item) => !('reservedCount' in item) && !('reserverNames' in item),
						),
					).toBe(true);
				} else if (role === 'visitor') {
					expect(
						giftsResult.gifts.every(
							(item) =>
								'reserverNames' in item &&
								Array.isArray(item.reserverNames) &&
								item.reserverNames.length === 0,
						),
					).toBe(true);
				} else {
					expect(
						giftsResult.gifts.some(
							(item) =>
								'reserverNames' in item &&
								Array.isArray(item.reserverNames) &&
								item.reserverNames.length > 0,
						),
					).toBe(true);
				}
			}
		});

		it('denies reads and commands across demo and real boundaries in both directions', async () => {
			const [foreign] = await getDb()
				.select()
				.from(wishlist)
				.where(
					and(
						eq(wishlist.demoSessionId, second.id),
						eq(wishlist.status, 'active'),
						isNull(wishlist.recipientUserId),
					),
				)
				.limit(1);
			const [foreignGift] = await getDb()
				.select()
				.from(gift)
				.where(eq(gift.wishlistId, foreign!.id))
				.limit(1);
			for (const target of [foreign!, { id: realWishlistId, shortId: realShortId }]) {
				await expect(
					asViewer(first, 'GET', () => getWishlistByShortId(target.shortId)),
				).rejects.toMatchObject({ status: 404 });
				await expect(
					asViewer(first, 'GET', () => getGiftsByWishlistShortId(target.shortId)),
				).rejects.toMatchObject({ status: 404 });
				await denied(() => createGift({ wishlistId: target.id, name: 'Crossed' }), 404);
				await denied(() => updateWishlist({ id: target.id, title: 'Crossed' }), 404);
			}
			for (const target of [foreignGift!.id, realGiftId]) {
				await denied(() => reserveGift({ giftId: target, quantity: 1 }), 404);
				await denied(() => updateGift({ id: target, description: 'Crossed' }), 404);
			}
			const [foreignReservation] = await getDb()
				.select({ id: reservation.id })
				.from(reservation)
				.innerJoin(gift, eq(gift.id, reservation.giftId))
				.where(
					and(
						eq(gift.wishlistId, foreign!.id),
						isNull(reservation.deletedAt),
						isNotNull(reservation.userId),
					),
				)
				.limit(1);
			expect(foreignReservation).toBeDefined();
			if (foreignReservation !== undefined) {
				await expect(
					asViewer(first, 'POST', () =>
						unreserveGift({ reservationId: foreignReservation.id }),
					),
				).rejects.toMatchObject({ status: 403 });
				expect(
					(
						await getDb()
							.select()
							.from(reservation)
							.where(eq(reservation.id, foreignReservation.id))
					)[0]?.deletedAt,
				).toBeNull();
			}
			const [own] = await getDb()
				.select()
				.from(wishlist)
				.where(eq(wishlist.demoSessionId, first.id))
				.limit(1);
			await expect(
				asViewer(second, 'GET', () => getWishlistByShortId(own!.shortId)),
			).rejects.toMatchObject({ status: 404 });
			await expect(
				asViewer(second, 'POST', () => updateWishlist({ id: own!.id, title: 'Crossed' })),
			).rejects.toMatchObject({ status: 404 });
			await expect(
				asViewer('real', 'GET', () => getWishlistByShortId(foreign!.shortId)),
			).rejects.toMatchObject({ status: 404 });
			await expect(
				asViewer('real', 'GET', () => getWishlistByShortId(own!.shortId)),
			).rejects.toMatchObject({ status: 404 });
			await expect(
				asViewer('real', 'GET', () => getGiftsByWishlistShortId(own!.shortId)),
			).rejects.toMatchObject({ status: 404 });
			await expect(
				asViewer('real', 'POST', () => updateWishlist({ id: own!.id, title: 'Crossed' })),
			).rejects.toMatchObject({ status: 404 });
			const [ownGift] = await getDb()
				.select()
				.from(gift)
				.where(eq(gift.wishlistId, own!.id))
				.limit(1);
			await expect(
				asViewer('real', 'POST', () =>
					updateGift({ id: ownGift!.id, description: 'Crossed' }),
				),
			).rejects.toMatchObject({ status: 404 });
		});

		it('keeps eligible edits private and rejects forbidden direct handlers before side effects', async () => {
			const [managed] = await getDb()
				.select()
				.from(wishlist)
				.where(
					and(
						eq(wishlist.demoSessionId, first.id),
						isNull(wishlist.recipientUserId),
						eq(wishlist.status, 'active'),
					),
				)
				.limit(1);
			const created = await asViewer(first, 'POST', () =>
				createWishlist({ recipientKind: 'self', title: 'My private list' }),
			);
			const createdId =
				typeof created === 'object' && created !== null && 'id' in created
					? created.id
					: undefined;
			expect(createdId).toBeDefined();
			const newGift = await asViewer(first, 'POST', () =>
				createGift({ wishlistId: managed!.id, name: 'Test gift' }),
			);
			await asViewer(first, 'POST', () =>
				updateGift({ id: newGift.id, description: 'Edited' }),
			);
			const [updated] = await getDb().select().from(gift).where(eq(gift.id, newGift.id));
			expect(updated?.description).toBe('Edited');
			const reserved = await asViewer(first, 'POST', () =>
				reserveGift({ giftId: newGift.id, quantity: 1 }),
			);
			const [active] = await getDb()
				.select()
				.from(reservation)
				.where(and(eq(reservation.giftId, newGift.id), isNull(reservation.deletedAt)));
			expect(active?.id).toBe(reserved.id);
			await asViewer(first, 'POST', () => unreserveGift({ reservationId: active!.id }));
			expect(
				(await getDb().select().from(reservation).where(eq(reservation.id, active!.id)))[0]
					?.deletedAt,
			).not.toBeNull();
			const fetchSpy = vi.spyOn(globalThis, 'fetch');
			try {
				await denied(
					() =>
						authorizeUpload({
							target: 'gift',
							fileName: 'x.jpg',
							contentType: 'image/jpeg',
							fileSize: 1,
						}),
					403,
				);
				await denied(
					() => fetchGoogleSheetCsv('https://docs.google.com/spreadsheets/d/abc/edit'),
					403,
				);
				await denied(
					() =>
						importGifts({
							wishlistId: managed!.id,
							gifts: [{ name: 'Blocked import' }],
						}),
					403,
				);
				await denied(() => shareWishlist(managed!.id), 403);
				await denied(
					() =>
						generateModeratorInviteLink({
							wishlistId: managed!.id,
							email: 'person@example.com',
						}),
					403,
				);
				await denied(() => updateProfile({ name: 'Changed', image: null }), 403);
				expect(fetchSpy).not.toHaveBeenCalled();
			} finally {
				fetchSpy.mockRestore();
			}
			expect(
				await getDb()
					.select()
					.from(moderatorInvite)
					.where(eq(moderatorInvite.wishlistId, managed!.id)),
			).toHaveLength(0);
			expect(
				(await getDb().select().from(wishlist).where(eq(wishlist.id, managed!.id)))[0]
					?.title,
			).toBe(managed!.title);
			expect(
				(await getDb().select().from(user).where(eq(user.id, first.viewerUserId)))[0]?.name,
			).toBe('Tereza Novotná');
			await resetDemo(first.id, 'cs');
			expect(await getDb().select().from(gift).where(eq(gift.id, newGift.id))).toHaveLength(
				0,
			);
			expect(
				await getDb().select().from(wishlist).where(eq(wishlist.demoSessionId, second.id)),
			).toHaveLength(8);
		});

		it('sends no email and writes no notification for eligible mutations that notify real users', async () => {
			const managed = await demoWishlist(first, 'managed');
			const own = await demoWishlist(first, 'own');
			const followed = await demoWishlist(first, 'followed');
			const reservedOnManaged = await reserveForAnotherPlaygroundPerson(first, managed.id);
			const giftToReserve = await unreservedGift(followed.id);
			const notificationsBefore = await playgroundNotificationCount(first);
			const fetchSpy = vi.spyOn(globalThis, 'fetch');
			try {
				await asViewer(first, 'POST', () =>
					updateGift({
						id: reservedOnManaged.giftId,
						description: 'Edited for the gifter',
					}),
				);
				await asViewer(first, 'POST', () =>
					createGift({ wishlistId: own.id, name: 'Digest candidate' }),
				);
				await asViewer(first, 'POST', () =>
					reserveGift({ giftId: giftToReserve.id, quantity: 1 }),
				);
				await asViewer(first, 'POST', () =>
					markGiftReceived({ giftId: reservedOnManaged.giftId, received: true }),
				);
				await asViewer(first, 'POST', () => archiveWishlist(managed.id));
				// Background delivery must also stay silent, not only the awaited request path.
				await new Promise((resolve) => setTimeout(resolve, 50));
				expect(sendEmail).not.toHaveBeenCalled();
				expect(fetchSpy).not.toHaveBeenCalled();
			} finally {
				fetchSpy.mockRestore();
			}
			expect(await playgroundNotificationCount(first)).toBe(notificationsBefore);
			const [editedGift] = await getDb()
				.select()
				.from(gift)
				.where(eq(gift.id, reservedOnManaged.giftId));
			expect(editedGift).toMatchObject({
				description: 'Edited for the gifter',
				received: true,
			});
			const [archivedList] = await getDb()
				.select()
				.from(wishlist)
				.where(eq(wishlist.id, managed.id));
			expect(archivedList?.status).toBe('archived');
			await resetDemo(first.id, 'cs');
		});

		it('persists received state and archiving, and keeps archived lists read-only', async () => {
			const own = await demoWishlist(first, 'own');
			const ownGift = await unreservedGift(own.id);
			async function receivedState(giftId: string) {
				const [row] = await getDb()
					.select({ received: gift.received })
					.from(gift)
					.where(eq(gift.id, giftId));
				return row?.received;
			}
			await asViewer(first, 'POST', () =>
				markGiftReceived({ giftId: ownGift.id, received: true }),
			);
			expect(await receivedState(ownGift.id)).toBe(true);
			await asViewer(first, 'POST', () =>
				markGiftReceived({ giftId: ownGift.id, received: false }),
			);
			expect(await receivedState(ownGift.id)).toBe(false);

			const managed = await demoWishlist(first, 'managed');
			const managedGift = await unreservedGift(managed.id);
			await asViewer(first, 'POST', () => archiveWishlist(managed.id));
			const listResult = await asViewer(first, 'GET', () =>
				getWishlistByShortId(managed.shortId),
			);
			expect(listResult.status).toBe('archived');
			await denied(() => createGift({ wishlistId: managed.id, name: 'Blocked' }), 400);
			await denied(() => updateGift({ id: managedGift.id, description: 'Blocked' }), 400);
			await denied(() => markGiftReceived({ giftId: managedGift.id, received: true }), 400);
			await denied(() => updateWishlist({ id: managed.id, title: 'Blocked' }), 400);
			const [curatedArchived] = await getDb()
				.select()
				.from(wishlist)
				.where(and(eq(wishlist.demoSessionId, first.id), eq(wishlist.status, 'archived')))
				.then((rows) => rows.filter((row) => row.id !== managed.id));
			const archivedGift = await unreservedGift(curatedArchived!.id);
			await denied(() => reserveGift({ giftId: archivedGift.id, quantity: 1 }), 400);
			const [unchangedGift] = await getDb()
				.select()
				.from(gift)
				.where(eq(gift.id, managedGift.id));
			expect(unchangedGift?.description).toBe(managedGift.description);
			await resetDemo(first.id, 'cs');
		});

		it('persists appearance on the demo person without touching the real account or appearance cookie', async () => {
			async function paletteOf(userId: string) {
				const [row] = await getDb()
					.select({ palette: user.palette })
					.from(user)
					.where(eq(user.id, userId));
				return row!.palette;
			}
			const realPalette = await paletteOf(realUserId);
			const demoPalette = await paletteOf(first.viewerUserId);
			const chosenPalette = PALETTES.find(
				(palette) => palette !== realPalette && palette !== demoPalette,
			)!;
			await asViewer(first, 'POST', () => setUserPalette(chosenPalette), {
				alongsideRealSession: true,
			});
			expect(await paletteOf(first.viewerUserId)).toBe(chosenPalette);
			expect(await paletteOf(realUserId)).toBe(realPalette);
			expect(writtenCookieNames).not.toContain(PALETTE_COOKIE_NAME);
			await asViewer('real', 'POST', () => setUserPalette(realPalette));
			expect(writtenCookieNames).toContain(PALETTE_COOKIE_NAME);
		});

		it('rejects other playground and real identifiers on every guarded handler in both directions', async () => {
			const ownManaged = await demoWishlist(first, 'managed');
			const ownReserved = await viewerReservationOn(first, ownManaged.id);
			const ownGift = await unreservedGift(ownManaged.id);
			const foreignManaged = await demoWishlist(second, 'managed');
			const foreignReserved = await viewerReservationOn(second, foreignManaged.id);
			const [ownClaim, foreignClaim, realClaim] = await getDb()
				.insert(claimInvite)
				.values([
					{ wishlistId: ownManaged.id, createdByUserId: first.viewerUserId },
					{ wishlistId: foreignManaged.id, createdByUserId: second.viewerUserId },
					{ wishlistId: realWishlistId, createdByUserId: realUserId },
				])
				.returning();
			const [ownModeratorInvite, foreignModeratorInvite, realModeratorInvite] = await getDb()
				.insert(moderatorInvite)
				.values([
					{ wishlistId: ownManaged.id, createdByUserId: first.viewerUserId },
					{ wishlistId: foreignManaged.id, createdByUserId: second.viewerUserId },
					{ wishlistId: realWishlistId, createdByUserId: realUserId },
				])
				.returning();

			interface Target {
				wishlistId: string;
				shortId: string;
				giftId: string;
				reservationId: string;
				claimToken: string;
				moderatorToken: string;
			}
			const anotherPlayground: Target = {
				wishlistId: foreignManaged.id,
				shortId: foreignManaged.shortId,
				giftId: foreignReserved.giftId,
				reservationId: foreignReserved.reservationId,
				claimToken: foreignClaim!.token,
				moderatorToken: foreignModeratorInvite!.token,
			};
			const realData: Target = {
				wishlistId: realWishlistId,
				shortId: realShortId,
				giftId: realGiftId,
				reservationId: realReservationId,
				claimToken: realClaim!.token,
				moderatorToken: realModeratorInvite!.token,
			};
			const visitorPlayground: Target = {
				wishlistId: ownManaged.id,
				shortId: ownManaged.shortId,
				giftId: ownGift.id,
				reservationId: ownReserved.reservationId,
				claimToken: ownClaim!.token,
				moderatorToken: ownModeratorInvite!.token,
			};
			const guardedOperations: Array<{
				name: string;
				method: 'GET' | 'POST';
				status: number;
				run: (target: Target) => Promise<unknown>;
			}> = [
				{
					name: 'getWishlistByShortId',
					method: 'GET',
					status: 404,
					run: (target) => getWishlistByShortId(target.shortId),
				},
				{
					name: 'getGiftsByWishlistShortId',
					method: 'GET',
					status: 404,
					run: (target) => getGiftsByWishlistShortId(target.shortId),
				},
				{
					name: 'getReservationLedgerForWishlist',
					method: 'GET',
					status: 404,
					run: (target) => getReservationLedgerForWishlist(target.shortId),
				},
				{
					name: 'getBulkCopyDestinations',
					method: 'GET',
					status: 404,
					run: (target) => getBulkCopyDestinations(target.wishlistId),
				},
				{
					name: 'toggleLike',
					method: 'POST',
					status: 404,
					run: (target) => toggleLike({ giftId: target.giftId }),
				},
				{
					name: 'setReservationPurchased',
					method: 'POST',
					status: 404,
					run: (target) =>
						setReservationPurchased({
							reservationId: target.reservationId,
							purchased: true,
						}),
				},
				{
					name: 'followWishlist',
					method: 'POST',
					status: 404,
					run: (target) => followWishlist(target.wishlistId),
				},
				{
					name: 'recordWishlistVisit',
					method: 'POST',
					status: 404,
					run: (target) => recordWishlistVisit(target.wishlistId),
				},
				{
					name: 'markGiftReceived',
					method: 'POST',
					status: 404,
					run: (target) => markGiftReceived({ giftId: target.giftId, received: true }),
				},
				{
					name: 'archiveWishlist',
					method: 'POST',
					status: 404,
					run: (target) => archiveWishlist(target.wishlistId),
				},
				{
					name: 'generateClaimInviteLink',
					method: 'POST',
					status: 404,
					run: (target) => generateClaimInviteLink({ wishlistId: target.wishlistId }),
				},
				{
					name: 'acceptClaimInvite',
					method: 'POST',
					status: 404,
					run: (target) => acceptClaimInvite({ token: target.claimToken }),
				},
				{
					name: 'acceptModeratorInvite',
					method: 'POST',
					status: 404,
					run: (target) => acceptModeratorInvite({ token: target.moderatorToken }),
				},
				{
					name: 'bulkCopyGifts from target',
					method: 'POST',
					status: 400,
					run: (target) =>
						bulkCopyGifts({
							sourceWishlistId: target.wishlistId,
							destinationWishlistId: ownManaged.id,
							giftIds: [target.giftId],
						}),
				},
				{
					name: 'bulkCopyGifts into target',
					method: 'POST',
					status: 400,
					run: (target) =>
						bulkCopyGifts({
							sourceWishlistId: ownManaged.id,
							destinationWishlistId: target.wishlistId,
							giftIds: [ownGift.id],
						}),
				},
			];
			for (const [label, viewer, target] of [
				['demo visitor against another playground', first, anotherPlayground],
				['demo visitor against real data', first, realData],
				['real user against a playground', 'real', visitorPlayground],
			] as const) {
				for (const operation of guardedOperations) {
					// Generating claim links is rejected outright inside the demo (covered below).
					if (operation.name === 'generateClaimInviteLink' && viewer !== 'real') {
						continue;
					}
					await expect(
						asViewer(viewer, operation.method, () => operation.run(target)),
						`${operation.name}: ${label}`,
					).rejects.toMatchObject({ status: operation.status });
				}
			}

			for (const viewer of ['real', 'anonymous'] as const) {
				await expect(
					asViewer(viewer, 'POST', () =>
						unreserveGift({ reservationId: ownReserved.reservationId }),
					),
					`unreserveGift by ${viewer} caller`,
				).rejects.toMatchObject({ status: 403 });
			}
			await denied(() => generateClaimInviteLink({ wishlistId: ownManaged.id }), 403);
			await denied(() => refreshGoogleAvatar(), 403);
			await denied(() => deleteAccount(), 403);
			await denied(
				() =>
					createWishlistFromImport({
						recipientKind: 'self',
						title: 'Imported',
						gifts: [{ name: 'Imported gift' }],
					}),
				403,
			);

			const touchedReservations = await getDb()
				.select()
				.from(reservation)
				.where(
					inArray(reservation.id, [
						ownReserved.reservationId,
						foreignReserved.reservationId,
						realReservationId,
					]),
				);
			expect(
				touchedReservations.every(
					(row) => row.deletedAt === null && row.purchasedAt === null,
				),
			).toBe(true);
			const invites = [
				...(await getDb()
					.select({ usedAt: claimInvite.usedAt })
					.from(claimInvite)
					.where(
						inArray(claimInvite.id, [ownClaim!.id, foreignClaim!.id, realClaim!.id]),
					)),
				...(await getDb()
					.select({ usedAt: moderatorInvite.usedAt })
					.from(moderatorInvite)
					.where(
						inArray(moderatorInvite.id, [
							ownModeratorInvite!.id,
							foreignModeratorInvite!.id,
							realModeratorInvite!.id,
						]),
					)),
			];
			expect(invites.every((invite) => invite.usedAt === null)).toBe(true);
			expect(
				(
					await getDb()
						.select({ status: wishlist.status })
						.from(wishlist)
						.where(
							inArray(wishlist.id, [
								foreignManaged.id,
								realWishlistId,
								ownManaged.id,
							]),
						)
				).some((row) => row.status === 'archived'),
			).toBe(false);
		});

		it('rejects uploaded image keys and unprepared image URLs while accepting prepared images', async () => {
			const managed = await demoWishlist(first, 'managed');
			const existing = await unreservedGift(managed.id);
			const preparedImageUrl = [...preparedDemoImageUrls][0]!;
			for (const image of [
				{ imageKey: 'gift/visitor-upload.jpg' },
				{ imageUrl: 'https://images.example.com/gift.jpg' },
				{ imageUrl: '/demo/../private.jpg' },
			]) {
				await denied(
					() => createGift({ wishlistId: managed.id, name: 'Image gift', ...image }),
					403,
				);
				await denied(() => updateGift({ id: existing.id, ...image }), 403);
			}
			await denied(
				() => updateWishlist({ id: managed.id, imageKey: 'wishlist/visitor-upload.jpg' }),
				403,
			);
			const created = await asViewer(first, 'POST', () =>
				createGift({
					wishlistId: managed.id,
					name: 'Prepared image gift',
					imageUrl: preparedImageUrl,
				}),
			);
			await asViewer(first, 'POST', () =>
				updateGift({ id: existing.id, imageUrl: preparedImageUrl }),
			);
			const storedImages = await getDb()
				.select({ imageUrl: gift.imageUrl, imageKey: gift.imageKey })
				.from(gift)
				.where(inArray(gift.id, [created.id, existing.id]));
			expect(storedImages).toEqual([
				{ imageUrl: preparedImageUrl, imageKey: null },
				{ imageUrl: preparedImageUrl, imageKey: null },
			]);
			await resetDemo(first.id, 'cs');
		});

		it('caps wishlists and gifts per playground at the configured limits', async () => {
			const playgroundLists = await getDb()
				.select({ id: wishlist.id })
				.from(wishlist)
				.where(eq(wishlist.demoSessionId, third.id));
			const fillerWishlistCount = DEMO_WISHLIST_LIMIT - playgroundLists.length - 1;
			await getDb()
				.insert(wishlist)
				.values(
					Array.from({ length: fillerWishlistCount }, (_, index) => ({
						demoSessionId: third.id,
						recipientUserId: third.viewerUserId,
						title: `Filler list ${index}`,
					})),
				);
			await asViewer(third, 'POST', () =>
				createWishlist({ recipientKind: 'self', title: 'Last allowed list' }),
			);
			await expect(
				asViewer(third, 'POST', () =>
					createWishlist({ recipientKind: 'self', title: 'Over the limit' }),
				),
			).rejects.toMatchObject({ status: 429 });
			expect(
				await getDb().select().from(wishlist).where(eq(wishlist.demoSessionId, third.id)),
			).toHaveLength(DEMO_WISHLIST_LIMIT);

			const managed = await demoWishlist(third, 'managed');
			const playgroundListIds = getDb()
				.select({ id: wishlist.id })
				.from(wishlist)
				.where(eq(wishlist.demoSessionId, third.id));
			const giftCount = async () =>
				(
					await getDb()
						.select({ id: gift.id })
						.from(gift)
						.where(inArray(gift.wishlistId, playgroundListIds))
				).length;
			const fillerGiftCount = DEMO_GIFT_LIMIT - (await giftCount()) - 1;
			await getDb()
				.insert(gift)
				.values(
					Array.from({ length: fillerGiftCount }, (_, index) => ({
						wishlistId: managed.id,
						name: `Filler gift ${index}`,
					})),
				);
			await asViewer(third, 'POST', () =>
				createGift({ wishlistId: managed.id, name: 'Last allowed gift' }),
			);
			await expect(
				asViewer(third, 'POST', () =>
					createGift({ wishlistId: managed.id, name: 'Over the limit' }),
				),
			).rejects.toMatchObject({ status: 429 });
			expect(await giftCount()).toBe(DEMO_GIFT_LIMIT);
		});
	},
);
