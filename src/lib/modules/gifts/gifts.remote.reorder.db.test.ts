import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq, inArray } from 'drizzle-orm';

const databaseUrl = process.env.DATABASE_URL ?? '';

function isLocalDatabaseUrl(value: string): boolean {
	try {
		const hostname = new URL(value).hostname.toLowerCase();
		return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
	} catch {
		return false;
	}
}

vi.mock('@sveltejs/kit/internal', () => ({ init_remote_functions: vi.fn() }));
vi.mock('$app/server', () => ({
	getRequestEvent: vi.fn(() => {
		throw new Error('no request context');
	}),
}));
vi.mock('$env/dynamic/private', () => ({ env: { DATABASE_URL: process.env.DATABASE_URL } }));
vi.mock('$lib/server/storage/r2.js', () => ({ deleteObjectsBestEffort: vi.fn() }));
vi.mock('$lib/server/anonymous_visitor.js', () => ({ getAnonVisitorId: vi.fn(() => null) }));
vi.mock('$lib/modules/notifications/notification_dispatcher.js', () => ({
	dispatchNotification: vi.fn(),
}));
vi.mock('$lib/server/remote.js', async () => {
	const v = await import('valibot');
	const wrapped = (handler: (...args: unknown[]) => unknown) => {
		(handler as unknown as { __: object }).__ = {};
		return handler;
	};
	return {
		guardedCommand: vi.fn(
			(schema: Parameters<typeof v.parse>[0], handler: (...args: unknown[]) => unknown) =>
				wrapped((auth: unknown, input: unknown) => handler(auth, v.parse(schema, input))),
		),
		guardedQueryWithArgs: vi.fn(
			(schema: Parameters<typeof v.parse>[0], handler: (...args: unknown[]) => unknown) =>
				wrapped((auth: unknown, input: unknown) => handler(auth, v.parse(schema, input))),
		),
		publicQuery: vi.fn((_schema: unknown, handler: (...args: unknown[]) => unknown) =>
			wrapped(handler),
		),
		singleFlightRefresh: vi.fn(),
	};
});

import { closeDb, getDb } from '$lib/server/db/index.js';
import { user } from '$lib/server/db/auth.schema.js';
import { priorityLevel, wishlist } from '$lib/server/db/wishlist.schema.js';
import { gift, giftCategory, reservation } from '$lib/server/db/gift.schema.js';
import { moderatorAssignment } from '$lib/server/db/moderator.schema.js';
import { dispatchNotification } from '$lib/modules/notifications/notification_dispatcher.js';
import { singleFlightRefresh } from '$lib/server/remote.js';
import { reorderGifts } from './gifts.remote.js';

import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import type { ReorderGiftsInput } from './types.js';

const PREFIX = `test-reorder-gifts-remote-${Date.now()}-`;
const RECIPIENT_ID = `${PREFIX}recipient`;
const MODERATOR_ID = `${PREFIX}moderator`;
const OUTSIDER_ID = `${PREFIX}outsider`;
const WISHLIST_ID = `${PREFIX}wishlist`;
const FOREIGN_WISHLIST_ID = `${PREFIX}foreign-wishlist`;
const ACTIVE_FIRST_ID = `${PREFIX}active-first`;
const ACTIVE_SECOND_ID = `${PREFIX}active-second`;
const ACTIVE_THIRD_ID = `${PREFIX}active-third`;
const RECEIVED_ID = `${PREFIX}received`;
const DELETED_ID = `${PREFIX}deleted`;
const FOREIGN_GIFT_ID = `${PREFIX}foreign-gift`;
const RECEIVED_SORT_ORDER = 7;
const DELETED_SORT_ORDER = 8;
const ACTIVE_GIFT_IDS = [ACTIVE_FIRST_ID, ACTIVE_SECOND_ID, ACTIVE_THIRD_ID];
const HIGH_PRIORITY_ID = `${PREFIX}priority-high`;
const LOW_PRIORITY_ID = `${PREFIX}priority-low`;
const FOREIGN_PRIORITY_ID = `${PREFIX}priority-foreign`;
const BOOKS_CATEGORY_ID = `${PREFIX}category-books`;
const DISABLED_CATEGORY_ID = `${PREFIX}category-disabled`;
const FOREIGN_CATEGORY_ID = `${PREFIX}category-foreign`;

async function isDbUsable(): Promise<boolean> {
	if (!isLocalDatabaseUrl(databaseUrl)) {
		return false;
	}
	try {
		await getDb().select({ id: gift.id }).from(gift).limit(1);
		return true;
	} catch {
		await closeDb().catch(() => undefined);
		return false;
	}
}

const DB_READY = await isDbUsable();

type ReorderGiftsHandler = (
	auth: { user: { id: string } },
	input: ReorderGiftsInput,
) => Promise<void>;
const callReorderGifts = reorderGifts as unknown as ReorderGiftsHandler;

async function sortOrdersById(): Promise<Map<string, number>> {
	const rows = await getDb()
		.select({ id: gift.id, sortOrder: gift.sortOrder })
		.from(gift)
		.where(inArray(gift.wishlistId, [WISHLIST_ID, FOREIGN_WISHLIST_ID]));
	return new Map(rows.map((row) => [row.id, row.sortOrder]));
}

describe.skipIf(!DB_READY)('reorderGifts remote boundary [real DB]', () => {
	beforeAll(async () => {
		const database = getDb();
		await database.insert(user).values([
			{
				id: RECIPIENT_ID,
				name: 'Reorder recipient',
				email: `${PREFIX}recipient@example.com`,
			},
			{
				id: MODERATOR_ID,
				name: 'Reorder moderator',
				email: `${PREFIX}moderator@example.com`,
			},
			{ id: OUTSIDER_ID, name: 'Reorder outsider', email: `${PREFIX}outsider@example.com` },
		]);
		await database.insert(wishlist).values([
			{
				id: WISHLIST_ID,
				shortId: `${PREFIX}short`,
				recipientUserId: RECIPIENT_ID,
				recipientName: null,
				title: 'Reorder list',
				status: 'active',
			},
			{
				id: FOREIGN_WISHLIST_ID,
				shortId: `${PREFIX}foreign-short`,
				recipientUserId: RECIPIENT_ID,
				recipientName: null,
				title: 'Other reorder list',
				status: 'active',
			},
		]);
		await database
			.insert(moderatorAssignment)
			.values({ wishlistId: WISHLIST_ID, userId: MODERATOR_ID });
		await database.insert(priorityLevel).values([
			{ id: HIGH_PRIORITY_ID, wishlistId: WISHLIST_ID, label: 'high', sortOrder: 0 },
			{ id: LOW_PRIORITY_ID, wishlistId: WISHLIST_ID, label: 'low', sortOrder: 2 },
			{
				id: FOREIGN_PRIORITY_ID,
				wishlistId: FOREIGN_WISHLIST_ID,
				label: 'high',
				sortOrder: 0,
			},
		]);
		await database.insert(giftCategory).values([
			{
				id: BOOKS_CATEGORY_ID,
				wishlistId: WISHLIST_ID,
				customLabel: 'Books',
				color: '#336699',
				sortOrder: 0,
			},
			{
				id: DISABLED_CATEGORY_ID,
				wishlistId: WISHLIST_ID,
				customLabel: 'Disabled',
				color: '#336699',
				sortOrder: 1,
				deletedAt: new Date(),
			},
			{
				id: FOREIGN_CATEGORY_ID,
				wishlistId: FOREIGN_WISHLIST_ID,
				customLabel: 'Foreign',
				color: '#336699',
				sortOrder: 0,
			},
		]);
	});

	beforeEach(async () => {
		await getDb()
			.insert(gift)
			.values([
				{ id: ACTIVE_FIRST_ID, wishlistId: WISHLIST_ID, name: 'First', sortOrder: 0 },
				{ id: ACTIVE_SECOND_ID, wishlistId: WISHLIST_ID, name: 'Second', sortOrder: 1 },
				{ id: ACTIVE_THIRD_ID, wishlistId: WISHLIST_ID, name: 'Third', sortOrder: 2 },
				{
					id: RECEIVED_ID,
					wishlistId: WISHLIST_ID,
					name: 'Received',
					received: true,
					sortOrder: RECEIVED_SORT_ORDER,
				},
				{
					id: DELETED_ID,
					wishlistId: WISHLIST_ID,
					name: 'Deleted',
					deletedAt: new Date(),
					sortOrder: DELETED_SORT_ORDER,
				},
				{
					id: FOREIGN_GIFT_ID,
					wishlistId: FOREIGN_WISHLIST_ID,
					name: 'Foreign',
					sortOrder: 0,
				},
			]);
	});

	afterEach(async () => {
		const database = getDb();
		await database
			.delete(gift)
			.where(inArray(gift.wishlistId, [WISHLIST_ID, FOREIGN_WISHLIST_ID]));
		await database
			.update(wishlist)
			.set({ status: 'active', sharedAt: null })
			.where(eq(wishlist.id, WISHLIST_ID));
		vi.mocked(dispatchNotification).mockClear();
		vi.mocked(singleFlightRefresh).mockClear();
	});

	afterAll(async () => {
		if (!DB_READY) {
			return;
		}
		await getDb()
			.delete(giftCategory)
			.where(inArray(giftCategory.wishlistId, [WISHLIST_ID, FOREIGN_WISHLIST_ID]));
		await getDb()
			.delete(priorityLevel)
			.where(inArray(priorityLevel.wishlistId, [WISHLIST_ID, FOREIGN_WISHLIST_ID]));
		await getDb()
			.delete(wishlist)
			.where(inArray(wishlist.id, [WISHLIST_ID, FOREIGN_WISHLIST_ID]));
		await getDb()
			.delete(user)
			.where(inArray(user.id, [RECIPIENT_ID, MODERATOR_ID, OUTSIDER_ID]));
		await closeDb();
	});

	it.each([
		{ managerDescription: 'recipient', managerId: RECIPIENT_ID },
		{ managerDescription: 'moderator', managerId: MODERATOR_ID },
	])(
		'persists the exact active set in payload order for the $managerDescription',
		async ({ managerId }) => {
			await callReorderGifts(
				{ user: { id: managerId } },
				{
					wishlistId: WISHLIST_ID,
					orderedGiftIds: [ACTIVE_THIRD_ID, ACTIVE_FIRST_ID, ACTIVE_SECOND_ID],
				},
			);

			const sortOrders = await sortOrdersById();
			expect(sortOrders.get(ACTIVE_THIRD_ID)).toBe(0);
			expect(sortOrders.get(ACTIVE_FIRST_ID)).toBe(1);
			expect(sortOrders.get(ACTIVE_SECOND_ID)).toBe(2);
			expect(sortOrders.get(RECEIVED_ID)).toBe(RECEIVED_SORT_ORDER);
			expect(sortOrders.get(DELETED_ID)).toBe(DELETED_SORT_ORDER);
			expect(sortOrders.get(FOREIGN_GIFT_ID)).toBe(0);
		},
	);

	it.each([
		{
			payloadDescription: 'omits an active gift',
			orderedGiftIds: [ACTIVE_THIRD_ID, ACTIVE_FIRST_ID],
		},
		{
			payloadDescription: 'includes a received gift',
			orderedGiftIds: [ACTIVE_THIRD_ID, ACTIVE_FIRST_ID, ACTIVE_SECOND_ID, RECEIVED_ID],
		},
		{
			payloadDescription: 'includes a deleted gift',
			orderedGiftIds: [ACTIVE_THIRD_ID, ACTIVE_FIRST_ID, ACTIVE_SECOND_ID, DELETED_ID],
		},
		{
			payloadDescription: 'includes a gift from another wishlist',
			orderedGiftIds: [ACTIVE_THIRD_ID, ACTIVE_FIRST_ID, ACTIVE_SECOND_ID, FOREIGN_GIFT_ID],
		},
		{
			payloadDescription: 'repeats a gift',
			orderedGiftIds: [ACTIVE_THIRD_ID, ACTIVE_FIRST_ID, ACTIVE_SECOND_ID, ACTIVE_FIRST_ID],
		},
	])('rejects a payload that $payloadDescription without writing', async ({ orderedGiftIds }) => {
		const sortOrdersBefore = await sortOrdersById();

		await expect(
			callReorderGifts(
				{ user: { id: RECIPIENT_ID } },
				{ wishlistId: WISHLIST_ID, orderedGiftIds },
			),
		).rejects.toMatchObject({
			status: 400,
			body: { message: SERVER_ERROR.GIFT_WISHLIST_MISMATCH },
		});
		expect(await sortOrdersById()).toEqual(sortOrdersBefore);
	});

	it('rejects a caller who does not manage the wishlist', async () => {
		const sortOrdersBefore = await sortOrdersById();

		await expect(
			callReorderGifts(
				{ user: { id: OUTSIDER_ID } },
				{ wishlistId: WISHLIST_ID, orderedGiftIds: [...ACTIVE_GIFT_IDS].reverse() },
			),
		).rejects.toMatchObject({ status: 403, body: { message: SERVER_ERROR.ACCESS_DENIED } });
		expect(await sortOrdersById()).toEqual(sortOrdersBefore);
	});

	it('rejects reorders on archived wishlists', async () => {
		await getDb()
			.update(wishlist)
			.set({ status: 'archived' })
			.where(eq(wishlist.id, WISHLIST_ID));
		const sortOrdersBefore = await sortOrdersById();

		await expect(
			callReorderGifts(
				{ user: { id: RECIPIENT_ID } },
				{ wishlistId: WISHLIST_ID, orderedGiftIds: [...ACTIVE_GIFT_IDS].reverse() },
			),
		).rejects.toMatchObject({
			status: 400,
			body: { message: SERVER_ERROR.CANNOT_MODIFY_ARCHIVED_WISHLIST },
		});
		expect(await sortOrdersById()).toEqual(sortOrdersBefore);
	});

	describe('group changes', () => {
		async function giftStateById() {
			const rows = await getDb()
				.select({
					id: gift.id,
					sortOrder: gift.sortOrder,
					priorityLevelId: gift.priorityLevelId,
					categoryId: gift.categoryId,
					editedAfterShareAt: gift.editedAfterShareAt,
				})
				.from(gift)
				.where(eq(gift.wishlistId, WISHLIST_ID));
			return new Map(rows.map((row) => [row.id, row]));
		}

		/** Gifts predate the share; the post-share grace window stays open briefly after it. */
		async function shareWishlist(sharedMillisecondsAgo: number) {
			await getDb()
				.update(wishlist)
				.set({ sharedAt: new Date(Date.now() - sharedMillisecondsAgo) })
				.where(eq(wishlist.id, WISHLIST_ID));
			await getDb()
				.update(gift)
				.set({ createdAt: new Date(Date.now() - 2 * 60 * 60_000) })
				.where(eq(gift.wishlistId, WISHLIST_ID));
		}

		async function shareWishlistLongAgo() {
			await shareWishlist(60 * 60_000);
		}

		it('persists the moved gift priority together with the new order', async () => {
			await callReorderGifts(
				{ user: { id: RECIPIENT_ID } },
				{
					wishlistId: WISHLIST_ID,
					orderedGiftIds: [ACTIVE_SECOND_ID, ACTIVE_FIRST_ID, ACTIVE_THIRD_ID],
					groupChanges: [
						{ giftId: ACTIVE_SECOND_ID, field: 'priority', value: HIGH_PRIORITY_ID },
					],
				},
			);

			const state = await giftStateById();
			expect(state.get(ACTIVE_SECOND_ID)).toMatchObject({
				sortOrder: 0,
				priorityLevelId: HIGH_PRIORITY_ID,
				editedAfterShareAt: null,
			});
			expect(state.get(ACTIVE_FIRST_ID)).toMatchObject({
				sortOrder: 1,
				priorityLevelId: null,
			});
			expect(singleFlightRefresh).toHaveBeenCalled();
		});

		it('moves a gift into a category and back to "Bez kategorie"', async () => {
			await callReorderGifts(
				{ user: { id: RECIPIENT_ID } },
				{
					wishlistId: WISHLIST_ID,
					orderedGiftIds: ACTIVE_GIFT_IDS,
					groupChanges: [
						{ giftId: ACTIVE_THIRD_ID, field: 'category', value: BOOKS_CATEGORY_ID },
					],
				},
			);
			expect((await giftStateById()).get(ACTIVE_THIRD_ID)?.categoryId).toBe(
				BOOKS_CATEGORY_ID,
			);

			await callReorderGifts(
				{ user: { id: RECIPIENT_ID } },
				{
					wishlistId: WISHLIST_ID,
					orderedGiftIds: ACTIVE_GIFT_IDS,
					groupChanges: [{ giftId: ACTIVE_THIRD_ID, field: 'category', value: null }],
				},
			);
			expect((await giftStateById()).get(ACTIVE_THIRD_ID)?.categoryId).toBeNull();
		});

		it('marks a changed priority on a shared wishlist as edited after sharing', async () => {
			await shareWishlistLongAgo();

			await callReorderGifts(
				{ user: { id: RECIPIENT_ID } },
				{
					wishlistId: WISHLIST_ID,
					orderedGiftIds: ACTIVE_GIFT_IDS,
					groupChanges: [
						{ giftId: ACTIVE_FIRST_ID, field: 'priority', value: LOW_PRIORITY_ID },
					],
				},
			);

			const state = await giftStateById();
			expect(state.get(ACTIVE_FIRST_ID)?.editedAfterShareAt).toBeInstanceOf(Date);
			expect(state.get(ACTIVE_SECOND_ID)?.editedAfterShareAt).toBeNull();
		});

		it.each([
			{
				graceDescription: 'inside the post-share grace window clears the badge',
				sharedMillisecondsAgo: 10_000,
				editedAfterRevert: null,
			},
			{
				graceDescription: 'after the post-share grace window keeps the badge',
				sharedMillisecondsAgo: 60 * 60_000,
				editedAfterRevert: expect.any(Date),
			},
		])(
			'reverting a group move (Vrátit) $graceDescription',
			async ({ sharedMillisecondsAgo, editedAfterRevert }) => {
				await shareWishlist(sharedMillisecondsAgo);

				await callReorderGifts(
					{ user: { id: RECIPIENT_ID } },
					{
						wishlistId: WISHLIST_ID,
						orderedGiftIds: [ACTIVE_SECOND_ID, ACTIVE_THIRD_ID, ACTIVE_FIRST_ID],
						groupChanges: [
							{ giftId: ACTIVE_FIRST_ID, field: 'priority', value: LOW_PRIORITY_ID },
						],
					},
				);
				expect((await giftStateById()).get(ACTIVE_FIRST_ID)?.editedAfterShareAt).toEqual(
					expect.any(Date),
				);

				await callReorderGifts(
					{ user: { id: RECIPIENT_ID } },
					{
						wishlistId: WISHLIST_ID,
						orderedGiftIds: ACTIVE_GIFT_IDS,
						groupChanges: [{ giftId: ACTIVE_FIRST_ID, field: 'priority', value: null }],
					},
				);

				expect((await giftStateById()).get(ACTIVE_FIRST_ID)).toMatchObject({
					sortOrder: 0,
					priorityLevelId: null,
					editedAfterShareAt: editedAfterRevert,
				});
			},
		);

		it('rejects group changes sent with an empty order when the wishlist has no active gifts', async () => {
			await getDb()
				.update(gift)
				.set({ received: true })
				.where(inArray(gift.id, [...ACTIVE_GIFT_IDS]));
			const stateBefore = await giftStateById();

			await expect(
				callReorderGifts(
					{ user: { id: RECIPIENT_ID } },
					{
						wishlistId: WISHLIST_ID,
						orderedGiftIds: [],
						groupChanges: [
							{ giftId: ACTIVE_FIRST_ID, field: 'priority', value: HIGH_PRIORITY_ID },
						],
					},
				),
			).rejects.toMatchObject({
				status: 400,
				body: { message: SERVER_ERROR.GIFT_WISHLIST_MISMATCH },
			});
			expect(await giftStateById()).toEqual(stateBefore);
		});

		it('leaves an unchanged value without a badge or refresh', async () => {
			await shareWishlistLongAgo();

			await callReorderGifts(
				{ user: { id: RECIPIENT_ID } },
				{
					wishlistId: WISHLIST_ID,
					orderedGiftIds: ACTIVE_GIFT_IDS,
					groupChanges: [{ giftId: ACTIVE_FIRST_ID, field: 'priority', value: null }],
				},
			);

			expect((await giftStateById()).get(ACTIVE_FIRST_ID)?.editedAfterShareAt).toBeNull();
			expect(singleFlightRefresh).not.toHaveBeenCalled();
		});

		it.each([
			{
				changeDescription: 'a priority level of another wishlist',
				change: { giftId: ACTIVE_FIRST_ID, field: 'priority', value: FOREIGN_PRIORITY_ID },
				message: SERVER_ERROR.GIFT_PRIORITY_WISHLIST_MISMATCH,
			},
			{
				changeDescription: 'a disabled category',
				change: { giftId: ACTIVE_FIRST_ID, field: 'category', value: DISABLED_CATEGORY_ID },
				message: SERVER_ERROR.GIFT_CATEGORY_WISHLIST_MISMATCH,
			},
			{
				changeDescription: 'a category of another wishlist',
				change: { giftId: ACTIVE_FIRST_ID, field: 'category', value: FOREIGN_CATEGORY_ID },
				message: SERVER_ERROR.GIFT_CATEGORY_WISHLIST_MISMATCH,
			},
			{
				changeDescription: 'a received gift',
				change: { giftId: RECEIVED_ID, field: 'priority', value: HIGH_PRIORITY_ID },
				message: SERVER_ERROR.GIFT_WISHLIST_MISMATCH,
			},
			{
				changeDescription: 'a gift of another wishlist',
				change: { giftId: FOREIGN_GIFT_ID, field: 'priority', value: HIGH_PRIORITY_ID },
				message: SERVER_ERROR.GIFT_WISHLIST_MISMATCH,
			},
		] as const)(
			'rejects $changeDescription and writes neither order nor group',
			async ({ change, message }) => {
				const stateBefore = await giftStateById();

				await expect(
					callReorderGifts(
						{ user: { id: RECIPIENT_ID } },
						{
							wishlistId: WISHLIST_ID,
							orderedGiftIds: [...ACTIVE_GIFT_IDS].reverse(),
							groupChanges: [
								{
									giftId: ACTIVE_SECOND_ID,
									field: 'priority',
									value: HIGH_PRIORITY_ID,
								},
								change,
							],
						},
					),
				).rejects.toMatchObject({ status: 400, body: { message } });
				expect(await giftStateById()).toEqual(stateBefore);
			},
		);

		it('notifies reservers when a moderator changes a reserved gift group', async () => {
			await getDb()
				.insert(reservation)
				.values({ giftId: ACTIVE_SECOND_ID, userId: OUTSIDER_ID, quantity: 1 });

			await callReorderGifts(
				{ user: { id: MODERATOR_ID } },
				{
					wishlistId: WISHLIST_ID,
					orderedGiftIds: ACTIVE_GIFT_IDS,
					groupChanges: [
						{ giftId: ACTIVE_SECOND_ID, field: 'category', value: BOOKS_CATEGORY_ID },
					],
				},
			);

			expect(dispatchNotification).toHaveBeenCalledWith(
				expect.objectContaining({ giftId: ACTIVE_SECOND_ID, targetUserIds: [OUTSIDER_ID] }),
			);
		});
	});
});
