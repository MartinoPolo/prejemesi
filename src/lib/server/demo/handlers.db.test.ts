import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm';

const databaseUrl = process.env.DEMO_TEST_DATABASE_URL ?? '';
let localDatabase = false;
try {
	const parsed = new URL(databaseUrl);
	localDatabase =
		['localhost', '127.0.0.1', '::1'].includes(parsed.hostname) &&
		parsed.pathname.length > 1 &&
		parsed.pathname !== '/local';
} catch {
	// Tests must not open an unrecognized database.
}
const enabled = process.env.DEMO_TEST_ISOLATED_DATABASE === '1' && localDatabase;

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

import { getRequestEvent } from '$app/server';
import { getDb, closeDb } from '$lib/server/db/index.js';
import { demoHandle } from '../../../hooks.server.js';
import { demoClientThrottle, demoSession, user } from '$lib/server/db/auth.schema.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { gift, reservation } from '$lib/server/db/gift.schema.js';
import { createDemo, resetDemo, DEMO_COOKIE } from './session.js';
import {
	getWishlistByShortId,
	createWishlist,
	updateWishlist,
} from '$lib/modules/wishlists/wishlists.remote.js';
import {
	getGiftsByWishlistShortId,
	createGift,
	updateGift,
} from '$lib/modules/gifts/gifts.remote.js';
import { reserveGift, unreserveGift } from '$lib/modules/reservations/reservations.remote.js';
import { authorizeUpload } from '$lib/modules/uploads/uploads.remote.js';
import { fetchGoogleSheetCsv, importGifts } from '$lib/modules/import/import.remote.js';
import { generateModeratorInviteLink } from '$lib/modules/moderators/moderators.remote.js';
import { moderatorInvite } from '$lib/server/db/moderator.schema.js';
import { shareWishlist } from '$lib/modules/sharing/sharing.remote.js';
import { updateProfile } from '$lib/modules/settings/settings.remote.js';

const sessions: string[] = [];
const addresses = ['127.0.0.31', '127.0.0.32'];
const realUserId = `handler-real-${Date.now()}`;
let realWishlistId: string;
let realShortId: string;
let realGiftId: string;
let first: { id: string; viewerUserId: string; token: string };
let second: { id: string; viewerUserId: string; token: string };

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

async function asViewer<T>(
	viewer: typeof first | null,
	method: 'GET' | 'POST',
	operation: () => Promise<T> | T,
): Promise<T> {
	const url = new URL('http://localhost/w/fixture');
	const event = {
		url,
		request: new Request(url, { method }),
		cookies: { get: (name: string) => (name === DEMO_COOKIE ? viewer?.token : undefined) },
		locals: viewer
			? {}
			: {
					user: { id: realUserId, name: 'Real', email: `${realUserId}@example.invalid` },
					session: { id: 'real' },
				},
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

describe.skipIf(!enabled)('actual demo remote handlers [isolated DB]', () => {
	beforeAll(async () => {
		const firstVisitor = visitor(addresses[0]!);
		const secondVisitor = visitor(addresses[1]!);
		const firstSession = await createDemo(
			firstVisitor as unknown as Parameters<typeof createDemo>[0],
			'cs',
		);
		sessions.push(firstSession.id);
		first = { ...firstSession, token: firstVisitor.cookies.get(DEMO_COOKIE)! };
		const secondSession = await createDemo(
			secondVisitor as unknown as Parameters<typeof createDemo>[0],
			'en',
		);
		sessions.push(secondSession.id);
		second = { ...secondSession, token: secondVisitor.cookies.get(DEMO_COOKIE)! };
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
	});

	afterAll(async () => {
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
	});

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
		if (foreignReservation) {
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
			asViewer(null, 'GET', () => getWishlistByShortId(foreign!.shortId)),
		).rejects.toMatchObject({ status: 404 });
		await expect(
			asViewer(null, 'GET', () => getWishlistByShortId(own!.shortId)),
		).rejects.toMatchObject({ status: 404 });
		await expect(
			asViewer(null, 'GET', () => getGiftsByWishlistShortId(own!.shortId)),
		).rejects.toMatchObject({ status: 404 });
		await expect(
			asViewer(null, 'POST', () => updateWishlist({ id: own!.id, title: 'Crossed' })),
		).rejects.toMatchObject({ status: 404 });
		const [ownGift] = await getDb()
			.select()
			.from(gift)
			.where(eq(gift.wishlistId, own!.id))
			.limit(1);
		await expect(
			asViewer(null, 'POST', () => updateGift({ id: ownGift!.id, description: 'Crossed' })),
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
		await asViewer(first, 'POST', () => updateGift({ id: newGift.id, description: 'Edited' }));
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
				() => importGifts({ wishlistId: managed!.id, gifts: [{ name: 'Blocked import' }] }),
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
			(await getDb().select().from(wishlist).where(eq(wishlist.id, managed!.id)))[0]?.title,
		).toBe(managed!.title);
		expect(
			(await getDb().select().from(user).where(eq(user.id, first.viewerUserId)))[0]?.name,
		).toBe('Tereza Novotná');
		await resetDemo(first.id, 'cs');
		expect(await getDb().select().from(gift).where(eq(gift.id, newGift.id))).toHaveLength(0);
		expect(
			await getDb().select().from(wishlist).where(eq(wishlist.demoSessionId, second.id)),
		).toHaveLength(8);
	});
});
