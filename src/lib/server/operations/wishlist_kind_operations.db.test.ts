import {
	DB_READY,
	RESERVER_ID,
	captureError,
	createGiftFixture,
	createWishlistFixture,
	errorMessage,
	managerActor,
	readGift,
	recipientActor,
	removeFixtureRows,
	reserveGift,
	seedFixtureUsers,
} from './operations.db.test-setup.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { priorityLevel, wishlist } from '$lib/server/db/wishlist.schema.js';
import { giftLike, reservation } from '$lib/server/db/gift.schema.js';
import { dispatchNotification } from '$lib/modules/notifications/notification_dispatcher.js';
import { NOTIFICATION_TYPE } from '$lib/modules/notifications/types.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { RECIPIENT_KIND, WISHLIST_KIND } from '$lib/modules/wishlists/types.js';
import { executeOperation } from './runner.js';
import {
	appendGiftDescriptionOperation,
	deleteGiftOperation,
	updateGiftOperation,
} from './gift_mutation_operations.js';
import { bulkUpdateGiftsOperation, reorderGiftsOperation } from './gift_bulk_operations.js';
import {
	createWishlistOperation,
	saveWishlistSettingsOperation,
	updateWishlistOperation,
} from './wishlist_detail_operations.js';
import { readWishlistOperation } from './wishlist_read_operations.js';
import { readBulkCopyDestinationsOperation } from './gift_read_operations.js';

const MINUTE_MS = 60 * 1000;
const sharedLongAgo = () => new Date(Date.now() - 60 * MINUTE_MS);
const preShareCreation = () => new Date(Date.now() - 120 * MINUTE_MS);
const YEAR_MS = 365 * 24 * 60 * MINUTE_MS;
const nextYear = () => new Date(Date.now() + YEAR_MS);
const lastYear = () => new Date(Date.now() - YEAR_MS);

async function readWishlistRow(wishlistId: string) {
	const [row] = await getDb().select().from(wishlist).where(eq(wishlist.id, wishlistId));
	if (row === undefined) {
		throw new Error(`Missing wishlist ${wishlistId}`);
	}
	return row;
}

async function releaseReservations(giftId: string) {
	await getDb()
		.update(reservation)
		.set({ deletedAt: new Date() })
		.where(eq(reservation.giftId, giftId));
}

function reservedGiftEditedNotifications() {
	return vi
		.mocked(dispatchNotification)
		.mock.calls.map(([input]) => input)
		.filter((input) => input.type === NOTIFICATION_TYPE.RESERVED_GIFT_EDITED);
}

async function expectRejected(work: Promise<unknown>, status: number, code: string) {
	const thrown = await captureError(work);
	expect(thrown).toMatchObject({ status });
	expect(errorMessage(thrown)).toBe(code);
}

describe.skipIf(!DB_READY)('permanent and occasion wishlists [real DB]', () => {
	beforeAll(seedFixtureUsers);

	beforeEach(() => {
		vi.mocked(dispatchNotification).mockClear();
	});

	afterAll(removeFixtureRows);

	describe('kind column', () => {
		it('reads a wishlist stored without a kind as an occasion wishlist', async () => {
			const { id, shortId } = await createWishlistFixture();

			expect((await readWishlistRow(id)).kind).toBe(WISHLIST_KIND.occasion);
			const view = await executeOperation(recipientActor, readWishlistOperation, {
				wishlistShortId: shortId,
			});
			expect(view.kind).toBe(WISHLIST_KIND.occasion);
		});

		it('tells copy destinations apart by kind', async () => {
			const permanentList = await createWishlistFixture({ kind: WISHLIST_KIND.permanent });
			const occasionList = await createWishlistFixture();

			const destinations = await executeOperation(
				recipientActor,
				readBulkCopyDestinationsOperation,
				{ sourceWishlistId: occasionList.id },
			);

			expect(
				destinations.find((destination) => destination.id === permanentList.id),
			).toMatchObject({ kind: WISHLIST_KIND.permanent });
		});
	});

	describe('unreserved gifts on a shared permanent wishlist', () => {
		async function sharedPermanentGift(values: Parameters<typeof createGiftFixture>[1] = {}) {
			const { id: wishlistId } = await createWishlistFixture({
				sharedAt: sharedLongAgo(),
				kind: WISHLIST_KIND.permanent,
			});
			return createGiftFixture(wishlistId, { createdAt: preShareCreation(), ...values });
		}

		it('lets the recipient rename, rewrite the description and lower quantity', async () => {
			const giftId = await sharedPermanentGift({
				name: 'Original',
				description: 'Original description',
				quantity: 3,
			});

			await executeOperation(recipientActor, updateGiftOperation, {
				id: giftId,
				name: 'Renamed',
				description: 'Rewritten description',
				quantity: 1,
			});

			const updated = await readGift(giftId);
			expect(updated).toMatchObject({
				name: 'Renamed',
				description: 'Rewritten description',
				descriptionAppends: [],
				quantity: 1,
			});
			expect(updated.editedAfterShareAt).not.toBeNull();
		});

		it('extends the description instead of adding a dated segment', async () => {
			const giftId = await sharedPermanentGift({ description: 'Original' });

			await executeOperation(recipientActor, appendGiftDescriptionOperation, {
				giftId,
				text: 'Blue preferred',
			});

			expect(await readGift(giftId)).toMatchObject({
				description: 'Original\n\nBlue preferred',
				descriptionAppends: [],
			});
		});

		it('lets the recipient delete a gift after every grace window', async () => {
			const giftId = await sharedPermanentGift();

			await executeOperation(recipientActor, deleteGiftOperation, { giftId });

			expect((await readGift(giftId)).deletedAt).not.toBeNull();
		});

		it('becomes fully editable and deletable again once its reservation is released', async () => {
			const giftId = await sharedPermanentGift({ name: 'Original', quantity: 3 });
			await reserveGift(giftId, RESERVER_ID);
			await releaseReservations(giftId);

			await executeOperation(recipientActor, updateGiftOperation, {
				id: giftId,
				name: 'Renamed',
				quantity: 1,
			});
			expect(await readGift(giftId)).toMatchObject({ name: 'Renamed', quantity: 1 });

			await executeOperation(recipientActor, deleteGiftOperation, { giftId });
			expect((await readGift(giftId)).deletedAt).not.toBeNull();
		});

		it('edits a segment appended while the gift was reserved, within its grace', async () => {
			const { id: wishlistId } = await createWishlistFixture({
				sharedAt: sharedLongAgo(),
				kind: WISHLIST_KIND.permanent,
			});
			const giftId = await createGiftFixture(wishlistId, { description: 'Original' });
			await reserveGift(giftId, RESERVER_ID);
			await executeOperation(recipientActor, appendGiftDescriptionOperation, {
				giftId,
				text: 'Size M',
			});
			await releaseReservations(giftId);

			await executeOperation(recipientActor, updateGiftOperation, {
				id: giftId,
				descriptionAppendEdit: { index: 0, text: 'Size L' },
			});

			expect(
				(await readGift(giftId)).descriptionAppends.map((append) => append.text),
			).toEqual(['Size L']);
		});

		it('rejects editing a kept segment after its grace', async () => {
			const giftId = await sharedPermanentGift({
				description: 'Original',
				descriptionAppends: [{ text: 'Size M', addedAt: sharedLongAgo().toISOString() }],
			});

			await expectRejected(
				executeOperation(recipientActor, updateGiftOperation, {
					id: giftId,
					descriptionAppendEdit: { index: 0, text: 'Size L' },
				}),
				403,
				SERVER_ERROR.CANNOT_EDIT_AFTER_SHARING,
			);
			expect(
				(await readGift(giftId)).descriptionAppends.map((append) => append.text),
			).toEqual(['Size M']);
		});
	});

	describe('reserved gifts on a shared permanent wishlist', () => {
		async function reservedPermanentGift(values: Parameters<typeof createGiftFixture>[1] = {}) {
			const { id: wishlistId } = await createWishlistFixture({
				sharedAt: sharedLongAgo(),
				kind: WISHLIST_KIND.permanent,
			});
			const giftId = await createGiftFixture(wishlistId, {
				createdAt: preShareCreation(),
				...values,
			});
			await reserveGift(giftId, RESERVER_ID);
			return { wishlistId, giftId };
		}

		it('keeps the name frozen, quantity raise-only and deletion blocked for the recipient', async () => {
			const { giftId } = await reservedPermanentGift({ name: 'Original', quantity: 3 });

			await expectRejected(
				executeOperation(recipientActor, updateGiftOperation, {
					id: giftId,
					name: 'Renamed',
				}),
				403,
				SERVER_ERROR.CANNOT_EDIT_AFTER_SHARING,
			);
			await expectRejected(
				executeOperation(recipientActor, updateGiftOperation, { id: giftId, quantity: 1 }),
				400,
				SERVER_ERROR.QUANTITY_CANNOT_BE_LOWERED,
			);
			await expectRejected(
				executeOperation(recipientActor, deleteGiftOperation, { giftId }),
				403,
				SERVER_ERROR.CANNOT_DELETE_AFTER_SHARING,
			);
			expect(await readGift(giftId)).toMatchObject({
				name: 'Original',
				quantity: 3,
				deletedAt: null,
			});
		});

		it('keeps a description edit append-only', async () => {
			const { giftId } = await reservedPermanentGift({ description: 'Original' });

			await executeOperation(recipientActor, updateGiftOperation, {
				id: giftId,
				description: 'Size M please',
			});

			const updated = await readGift(giftId);
			expect(updated.description).toBe('Original');
			expect(updated.descriptionAppends.map((append) => append.text)).toEqual([
				'Size M please',
			]);
		});

		it('notifies the reserver when the recipient changes the gift', async () => {
			const { giftId } = await reservedPermanentGift();

			await executeOperation(recipientActor, updateGiftOperation, { id: giftId, price: 900 });

			const notifications = reservedGiftEditedNotifications();
			expect(notifications).toHaveLength(1);
			expect(notifications[0]).toMatchObject({ targetUserIds: [RESERVER_ID], giftId });
		});

		it('notifies the reserver of a recipient bulk edit', async () => {
			const { wishlistId, giftId } = await reservedPermanentGift();

			await executeOperation(recipientActor, bulkUpdateGiftsOperation, {
				wishlistId,
				giftIds: [giftId],
				action: 'imageBackground',
				background: '#000000',
			});

			const notifications = reservedGiftEditedNotifications();
			expect(notifications).toHaveLength(1);
			expect(notifications[0]).toMatchObject({ targetUserIds: [RESERVER_ID], giftId });
		});

		it('notifies the reserver when the recipient moves the gift to another priority', async () => {
			const { wishlistId, giftId } = await reservedPermanentGift();
			const [level] = await getDb()
				.insert(priorityLevel)
				.values({ wishlistId, label: 'Top', sortOrder: 0 })
				.returning({ id: priorityLevel.id });

			await executeOperation(recipientActor, reorderGiftsOperation, {
				wishlistId,
				orderedGiftIds: [giftId],
				groupChanges: [{ giftId, field: 'priority', value: level?.id ?? null }],
			});

			const notifications = reservedGiftEditedNotifications();
			expect(notifications).toHaveLength(1);
			expect(notifications[0]).toMatchObject({ targetUserIds: [RESERVER_ID], giftId });
		});
	});

	describe('shared occasion wishlist', () => {
		it('keeps the name freeze and deletion grace for an unreserved gift', async () => {
			const { id: wishlistId } = await createWishlistFixture({ sharedAt: sharedLongAgo() });
			const giftId = await createGiftFixture(wishlistId, {
				createdAt: preShareCreation(),
				name: 'Original',
			});

			await expectRejected(
				executeOperation(recipientActor, updateGiftOperation, {
					id: giftId,
					name: 'Renamed',
				}),
				403,
				SERVER_ERROR.CANNOT_EDIT_AFTER_SHARING,
			);
			await expectRejected(
				executeOperation(recipientActor, deleteGiftOperation, { giftId }),
				403,
				SERVER_ERROR.CANNOT_DELETE_AFTER_SHARING,
			);
		});

		it('does not notify the reserver of a recipient edit', async () => {
			const { id: wishlistId } = await createWishlistFixture({ sharedAt: sharedLongAgo() });
			const giftId = await createGiftFixture(wishlistId, { createdAt: preShareCreation() });
			await reserveGift(giftId, RESERVER_ID);

			await executeOperation(recipientActor, updateGiftOperation, { id: giftId, price: 900 });

			expect(reservedGiftEditedNotifications()).toHaveLength(0);
		});
	});

	describe('creation', () => {
		it('creates a permanent wishlist without an event date', async () => {
			const created = await executeOperation(recipientActor, createWishlistOperation, {
				recipientKind: RECIPIENT_KIND.self,
				title: 'Always wanted',
				kind: WISHLIST_KIND.permanent,
			});

			expect(created).toMatchObject({ kind: WISHLIST_KIND.permanent, eventDate: null });
		});

		it('creates an occasion wishlist by default', async () => {
			const created = await executeOperation(recipientActor, createWishlistOperation, {
				recipientKind: RECIPIENT_KIND.self,
				title: 'Birthday',
			});

			expect(created.kind).toBe(WISHLIST_KIND.occasion);
		});

		it('rejects an event date on a permanent wishlist', async () => {
			await expectRejected(
				executeOperation(recipientActor, createWishlistOperation, {
					recipientKind: RECIPIENT_KIND.self,
					title: 'Always wanted',
					kind: WISHLIST_KIND.permanent,
					eventDate: nextYear(),
				}),
				400,
				SERVER_ERROR.PERMANENT_WISHLIST_EVENT_DATE,
			);
		});
	});

	describe('event date on a permanent wishlist', () => {
		it('rejects setting an event date through details and settings', async () => {
			const { id } = await createWishlistFixture({ kind: WISHLIST_KIND.permanent });

			await expectRejected(
				executeOperation(recipientActor, updateWishlistOperation, {
					id,
					eventDate: nextYear(),
				}),
				400,
				SERVER_ERROR.PERMANENT_WISHLIST_EVENT_DATE,
			);
			await expectRejected(
				executeOperation(recipientActor, saveWishlistSettingsOperation, {
					wishlistId: id,
					details: { title: 'Always wanted', description: null, eventDate: nextYear() },
				}),
				400,
				SERVER_ERROR.PERMANENT_WISHLIST_EVENT_DATE,
			);
			expect((await readWishlistRow(id)).eventDate).toBeNull();
		});
	});

	describe('kind changes', () => {
		it('turns a draft occasion wishlist permanent and clears its past event date', async () => {
			const { id } = await createWishlistFixture({ eventDate: lastYear() });

			await executeOperation(recipientActor, updateWishlistOperation, {
				id,
				kind: WISHLIST_KIND.permanent,
			});

			expect(await readWishlistRow(id)).toMatchObject({
				kind: WISHLIST_KIND.permanent,
				eventDate: null,
				eventDateEditedAt: null,
			});
		});

		it('turns a draft occasion wishlist permanent through the settings', async () => {
			const { id } = await createWishlistFixture();

			await executeOperation(recipientActor, saveWishlistSettingsOperation, {
				wishlistId: id,
				details: {
					title: 'Always wanted',
					description: null,
					kind: WISHLIST_KIND.permanent,
				},
			});

			expect(await readWishlistRow(id)).toMatchObject({
				kind: WISHLIST_KIND.permanent,
				title: 'Always wanted',
				eventDate: null,
			});
		});

		it.each([
			['draft', null],
			['shared', sharedLongAgo()],
		])(
			'rejects turning a %s occasion wishlist with an upcoming event date permanent',
			async (_state, sharedAt) => {
				const eventDate = nextYear();
				const { id } = await createWishlistFixture({ sharedAt, eventDate });

				await expectRejected(
					executeOperation(managerActor, saveWishlistSettingsOperation, {
						wishlistId: id,
						details: {
							title: 'Birthday',
							description: null,
							kind: WISHLIST_KIND.permanent,
						},
					}),
					409,
					SERVER_ERROR.CANNOT_MAKE_WISHLIST_WITH_UPCOMING_EVENT_PERMANENT,
				);
				const unchanged = await readWishlistRow(id);
				expect(unchanged.kind).toBe(WISHLIST_KIND.occasion);
				expect(unchanged.eventDate?.getTime()).toBe(eventDate.getTime());
			},
		);

		it.each([
			['no event date', null],
			['a past event date', lastYear()],
		])(
			'lets a správce turn a shared occasion wishlist with %s permanent, keeping reservations and likes',
			async (_eventDateCase, eventDate) => {
				const { id } = await createWishlistFixture({
					sharedAt: sharedLongAgo(),
					eventDate,
				});
				const giftId = await createGiftFixture(id, { createdAt: preShareCreation() });
				await reserveGift(giftId, RESERVER_ID);
				await getDb().insert(giftLike).values({ giftId, userId: RESERVER_ID });

				await executeOperation(managerActor, saveWishlistSettingsOperation, {
					wishlistId: id,
					details: {
						title: 'Always wanted',
						description: null,
						kind: WISHLIST_KIND.permanent,
					},
				});

				expect(await readWishlistRow(id)).toMatchObject({
					kind: WISHLIST_KIND.permanent,
					status: 'active',
					eventDate: null,
					eventDateEditedAt: null,
				});
				const activeReservations = await getDb()
					.select({ id: reservation.id })
					.from(reservation)
					.where(and(eq(reservation.giftId, giftId), isNull(reservation.deletedAt)));
				expect(activeReservations).toHaveLength(1);
				const activeLikes = await getDb()
					.select({ id: giftLike.id })
					.from(giftLike)
					.where(and(eq(giftLike.giftId, giftId), isNull(giftLike.deletedAt)));
				expect(activeLikes).toHaveLength(1);
			},
		);

		it('turns a shared permanent wishlist into an occasion with strict rules from then on', async () => {
			const { id } = await createWishlistFixture({
				sharedAt: sharedLongAgo(),
				kind: WISHLIST_KIND.permanent,
			});
			const giftId = await createGiftFixture(id, {
				createdAt: preShareCreation(),
				name: 'Original',
			});

			await executeOperation(recipientActor, updateWishlistOperation, {
				id,
				kind: WISHLIST_KIND.occasion,
			});

			expect((await readWishlistRow(id)).kind).toBe(WISHLIST_KIND.occasion);
			await expectRejected(
				executeOperation(recipientActor, updateGiftOperation, {
					id: giftId,
					name: 'Renamed',
				}),
				403,
				SERVER_ERROR.CANNOT_EDIT_AFTER_SHARING,
			);
			await expectRejected(
				executeOperation(recipientActor, deleteGiftOperation, { giftId }),
				403,
				SERVER_ERROR.CANNOT_DELETE_AFTER_SHARING,
			);
		});

		it('opens a fresh event-date window when a shared permanent wishlist becomes an occasion', async () => {
			const { id } = await createWishlistFixture({
				sharedAt: sharedLongAgo(),
				kind: WISHLIST_KIND.permanent,
			});
			const eventDate = nextYear();

			await executeOperation(recipientActor, updateWishlistOperation, {
				id,
				kind: WISHLIST_KIND.occasion,
			});
			await executeOperation(recipientActor, updateWishlistOperation, { id, eventDate });

			expect((await readWishlistRow(id)).eventDate?.getTime()).toBe(eventDate.getTime());
		});

		it('sets the event date in the same save that makes a shared permanent wishlist an occasion', async () => {
			const { id } = await createWishlistFixture({
				sharedAt: sharedLongAgo(),
				kind: WISHLIST_KIND.permanent,
			});
			const eventDate = nextYear();

			await executeOperation(recipientActor, updateWishlistOperation, {
				id,
				kind: WISHLIST_KIND.occasion,
				eventDate,
			});

			const updated = await readWishlistRow(id);
			expect(updated.eventDate?.getTime()).toBe(eventDate.getTime());
			expect(updated.eventDateEditedAt).not.toBeNull();
		});

		it('rejects a kind change on an archived wishlist', async () => {
			const { id } = await createWishlistFixture({
				status: 'archived',
				kind: WISHLIST_KIND.permanent,
			});

			await expectRejected(
				executeOperation(recipientActor, updateWishlistOperation, {
					id,
					kind: WISHLIST_KIND.occasion,
				}),
				400,
				SERVER_ERROR.CANNOT_MODIFY_ARCHIVED_WISHLIST,
			);
		});
	});
});
