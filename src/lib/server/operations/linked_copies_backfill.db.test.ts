import {
	DB_READY,
	RECIPIENT_ID,
	RESERVER_ID,
	SECOND_RESERVER_ID,
	createGiftFixture,
	createWishlistFixture,
	readGift,
	removeFixtureRows,
	reserveGift,
	revisionsForGift,
	seedFixtureUsers,
} from './operations.db.test-setup.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { gift, giftImage, reservation } from '$lib/server/db/gift.schema.js';
import { WISHLIST_KIND, WISHLIST_OCCASION } from '$lib/modules/wishlists/types.js';
import {
	createCustomGiftCategoryWithDatabase,
	getActiveGiftCategories,
} from '$lib/modules/gift-categories/gift_categories_service.js';
import {
	MATCH_OUTCOME,
	applyLinkedCopiesPlan,
	findOwner,
	proposeLinkedCopiesPlan,
	type BackfillOwner,
} from '../../../../scripts/lib/linked-copies-backfill.js';
import {
	AMBIGUITY_REASON,
	parseReviewedPlan,
	type LinkedCopiesPlan,
} from '../../../../scripts/lib/linked-copies-plan.js';

const DATABASE_LABEL = 'localhost:5432/test';

beforeAll(async () => {
	if (DB_READY) {
		await seedFixtureUsers();
	}
});
afterAll(removeFixtureRows);

async function requireOwner(): Promise<BackfillOwner> {
	const owner = await findOwner(getDb(), RECIPIENT_ID);
	if (owner === undefined) {
		throw new Error('Missing owner fixture');
	}
	return owner;
}

async function addGalleryImage(giftId: string, imageKey: string): Promise<void> {
	await getDb()
		.insert(giftImage)
		.values({ giftId, position: 0, imageKey, imageUrl: null, imageMeta: null });
	await getDb().update(gift).set({ imageKey }).where(eq(gift.id, giftId));
}

/** A shared permanent list and a shared Christmas-like occasion list of the same recipient. */
async function familyLists() {
	const sharedAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
	const permanentWishlist = await createWishlistFixture({
		kind: WISHLIST_KIND.permanent,
		sharedAt,
	});
	const occasionWishlist = await createWishlistFixture({
		kind: WISHLIST_KIND.occasion,
		sharedAt,
	});
	return { permanentWishlist, occasionWishlist, createdAt: new Date(sharedAt.getTime() - 1000) };
}

async function proposeFor(
	permanentWishlistId: string,
	occasionWishlistId: string,
): Promise<LinkedCopiesPlan> {
	return proposeLinkedCopiesPlan(getDb(), {
		owner: await requireOwner(),
		pairs: [{ permanent: permanentWishlistId, occasion: occasionWishlistId }],
		databaseLabel: DATABASE_LABEL,
	});
}

function confirmAll(plan: LinkedCopiesPlan) {
	return parseReviewedPlan(
		JSON.parse(
			JSON.stringify({
				...plan,
				pairs: plan.pairs.map((pair) => ({ ...pair, confirmed: true })),
			}),
		),
	);
}

async function activeReservationCount(giftIds: readonly string[]): Promise<number> {
	const rows = await getDb()
		.select({ id: reservation.id })
		.from(reservation)
		.where(and(inArray(reservation.giftId, [...giftIds]), isNull(reservation.deletedAt)));
	return rows.length;
}

describe.skipIf(!DB_READY)('linked gift copies backfill (issue #742)', () => {
	it('links confirmed matches with the occasion copy’s values and leaves reservations alone', async () => {
		const { permanentWishlist, occasionWishlist, createdAt } = await familyLists();
		const occasionCategory = await createCustomGiftCategoryWithDatabase(getDb(), {
			wishlistId: occasionWishlist.id,
			label: 'Stavebnice',
		});
		const occasionGiftId = await createGiftFixture(occasionWishlist.id, {
			name: 'LEGO Technic',
			price: 1200,
			quantity: 1,
			categoryIds: [occasionCategory.id],
			createdAt,
		});
		const permanentGiftId = await createGiftFixture(permanentWishlist.id, {
			name: 'lego  technic',
			price: 999,
			quantity: 1,
			received: true,
			sortOrder: 7,
			createdAt,
		});
		await addGalleryImage(occasionGiftId, 'gifts/occasion-lego.webp');
		await addGalleryImage(permanentGiftId, 'gifts/permanent-lego.webp');
		await reserveGift(occasionGiftId, RESERVER_ID);
		await reserveGift(permanentGiftId, SECOND_RESERVER_ID);
		const ambiguousGiftIds = [
			await createGiftFixture(occasionWishlist.id, { name: 'Ponožky' }),
			await createGiftFixture(occasionWishlist.id, { name: 'ponozky' }),
			await createGiftFixture(permanentWishlist.id, { name: 'Ponožky' }),
		];

		const plan = await proposeFor(permanentWishlist.id, occasionWishlist.id);

		const [pair] = plan.pairs;
		expect(pair?.matches.map((match) => [match.occasion.id, match.permanent.id])).toEqual([
			[occasionGiftId, permanentGiftId],
		]);
		expect(pair?.matches[0]?.reservationConflict).toMatchObject({ bothCopiesReserved: true });
		expect(pair?.ambiguous.map((candidate) => candidate.reason)).toEqual([
			AMBIGUITY_REASON.duplicateName,
		]);

		const reviewedPlan = confirmAll(plan);
		const dryRun = await applyLinkedCopiesPlan(getDb(), reviewedPlan, { execute: false });

		expect(dryRun.pairs[0]?.matches[0]).toMatchObject({ outcome: MATCH_OUTCOME.linked });
		expect((await readGift(occasionGiftId)).linkGroupId).toBeNull();
		expect((await readGift(permanentGiftId)).linkGroupId).toBeNull();
		expect(await revisionsForGift(permanentGiftId)).toEqual([]);

		const executed = await applyLinkedCopiesPlan(getDb(), reviewedPlan, { execute: true });

		expect(executed.pairs[0]?.matches[0]).toMatchObject({
			outcome: MATCH_OUTCOME.linked,
			joinedExistingGroup: false,
			releasedImageKeys: ['gifts/permanent-lego.webp'],
		});
		const occasionAfter = await readGift(occasionGiftId);
		const permanentAfter = await readGift(permanentGiftId);
		expect(occasionAfter.linkGroupId).not.toBeNull();
		expect(permanentAfter.linkGroupId).toBe(occasionAfter.linkGroupId);
		expect(permanentAfter).toMatchObject({
			name: 'LEGO Technic',
			price: 1200,
			received: true,
			sortOrder: 7,
		});
		expect(occasionAfter.received).toBe(true);
		expect(permanentAfter.images.map((image) => image.imageKey)).toEqual([
			'gifts/occasion-lego.webp',
		]);
		const permanentCategories = await getActiveGiftCategories(permanentWishlist.id);
		const mappedCategory = permanentCategories.find(
			(category) => category.customLabel === 'Stavebnice',
		);
		expect(permanentAfter.categoryIds).toEqual([mappedCategory?.id]);
		expect(await activeReservationCount([occasionGiftId, permanentGiftId])).toBe(2);
		expect(
			(await revisionsForGift(permanentGiftId)).map((revision) => revision.channel),
		).toEqual(['token:linked-copies-backfill']);
		for (const ambiguousGiftId of ambiguousGiftIds) {
			expect((await readGift(ambiguousGiftId)).linkGroupId).toBeNull();
		}

		const repeated = await applyLinkedCopiesPlan(getDb(), reviewedPlan, { execute: true });

		expect(repeated.pairs[0]?.matches[0]).toMatchObject({ outcome: MATCH_OUTCOME.skipped });
	});

	it('skips a match whose gift changed after propose', async () => {
		const { permanentWishlist, occasionWishlist } = await familyLists();
		const occasionGiftId = await createGiftFixture(occasionWishlist.id, { name: 'Kolo' });
		const permanentGiftId = await createGiftFixture(permanentWishlist.id, { name: 'Kolo' });
		const plan = confirmAll(await proposeFor(permanentWishlist.id, occasionWishlist.id));
		await getDb()
			.update(gift)
			.set({ price: 5000, updatedAt: new Date() })
			.where(eq(gift.id, permanentGiftId));

		const report = await applyLinkedCopiesPlan(getDb(), plan, { execute: true });

		expect(report.pairs[0]?.matches[0]).toEqual(
			expect.objectContaining({
				outcome: MATCH_OUTCOME.skipped,
				reason: `gift ${permanentGiftId} changed since propose`,
			}),
		);
		expect((await readGift(occasionGiftId)).linkGroupId).toBeNull();
	});

	it('applies nothing from a pair left unconfirmed', async () => {
		const { permanentWishlist, occasionWishlist } = await familyLists();
		const permanentGiftId = await createGiftFixture(permanentWishlist.id, { name: 'Hra' });
		await createGiftFixture(occasionWishlist.id, { name: 'Hra' });
		const plan = parseReviewedPlan(
			JSON.parse(JSON.stringify(await proposeFor(permanentWishlist.id, occasionWishlist.id))),
		);

		const report = await applyLinkedCopiesPlan(getDb(), plan, { execute: true });

		expect(report.pairs[0]).toMatchObject({ outcome: 'skipped', reason: 'not confirmed' });
		expect((await readGift(permanentGiftId)).linkGroupId).toBeNull();
	});

	it('pairs only the owner’s permanent lists with occasion lists of the same recipient', async () => {
		const { permanentWishlist, occasionWishlist } = await familyLists();

		const plan = await proposeLinkedCopiesPlan(getDb(), {
			owner: await requireOwner(),
			pairs: [],
			databaseLabel: DATABASE_LABEL,
		});

		const pairIds = plan.pairs.map((pair) => [
			pair.permanentWishlist.id,
			pair.occasionWishlist.id,
		]);
		expect(pairIds).toContainEqual([permanentWishlist.id, occasionWishlist.id]);
		expect(pairIds).not.toContainEqual([occasionWishlist.id, permanentWishlist.id]);
		expect(
			plan.pairs.every(
				(pair) => pair.permanentWishlist.occasion === WISHLIST_OCCASION.permanent,
			),
		).toBe(true);
	});
});
