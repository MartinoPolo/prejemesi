import { describe, expect, it } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import { formatPrice } from '$lib/modules/gifts/gift_display.js';
import {
	GIFT_DIFF_FIELD,
	appendedDescriptions,
	giftFieldDiffs,
	reorderMoves,
	showsGiftCards,
	type GiftLabelLookups,
} from './change_review_diffs.js';
import type { ChangeProposalGift } from './types.js';

const CATEGORY_LABELS = new Map([
	['cat-books', 'Knihy'],
	['cat-toys', 'Hračky'],
	['cat-games', 'Hry'],
]);

const lookups: GiftLabelLookups = {
	categoryLabel: (categoryId) => CATEGORY_LABELS.get(categoryId) ?? null,
	priorityLabel: (priorityLevelId) => (priorityLevelId === 'prio-high' ? 'Vysoká' : null),
};

function gift(overrides: Partial<ChangeProposalGift> = {}): ChangeProposalGift {
	return {
		name: 'Kniha Duna',
		description: null,
		descriptionAppends: [],
		links: [],
		price: null,
		priceMax: null,
		currency: null,
		imageUrl: null,
		imageMeta: null,
		quantity: null,
		priorityLevelId: null,
		categoryIds: [],
		received: false,
		deleted: false,
		editedAfterShareAt: null,
		...overrides,
	};
}

describe('gift field diffs', () => {
	it('lists a new gift’s filled fields as new values, labels included', () => {
		const created = gift({
			description: '  Vázané vydání  ',
			price: 450,
			currency: 'CZK',
			categoryIds: ['cat-books'],
			priorityLevelId: 'prio-high',
			links: [{ url: 'https://www.knihy.cz/duna' }],
		});

		expect(giftFieldDiffs(null, created, lookups)).toEqual([
			{ field: GIFT_DIFF_FIELD.name, before: null, after: 'Kniha Duna' },
			{ field: GIFT_DIFF_FIELD.description, before: null, after: 'Vázané vydání' },
			{ field: GIFT_DIFF_FIELD.price, before: null, after: formatPrice(450, 'CZK', null) },
			{ field: GIFT_DIFF_FIELD.category, before: null, after: 'Knihy' },
			{ field: GIFT_DIFF_FIELD.priority, before: null, after: 'Vysoká' },
			{ field: GIFT_DIFF_FIELD.link, before: null, after: 'knihy.cz' },
		]);
	});

	it('names a deleted gift as removed instead of listing its fields', () => {
		const before = gift({ price: 450, currency: 'CZK' });

		expect(giftFieldDiffs(before, { ...before, deleted: true }, lookups)).toEqual([
			{ field: GIFT_DIFF_FIELD.gift, before: 'Kniha Duna', after: null },
		]);
	});

	it('pairs only the changed fields of an edit, with a placeholder for a cleared value', () => {
		const before = gift({ price: 450, currency: 'CZK', categoryIds: ['cat-books'] });
		const after = gift({ name: 'Kniha Duna (brožovaná)', price: 450, currency: 'CZK' });

		expect(giftFieldDiffs(before, after, lookups)).toEqual([
			{ field: GIFT_DIFF_FIELD.name, before: 'Kniha Duna', after: 'Kniha Duna (brožovaná)' },
			{
				field: GIFT_DIFF_FIELD.category,
				before: 'Knihy',
				after: m.change_review_value_none(),
			},
		]);
	});

	it('shows several categories as their labels joined in order, primary first', () => {
		const before = gift({ categoryIds: ['cat-books', 'cat-toys'] });
		const after = gift({ categoryIds: ['cat-games', 'cat-books', 'cat-toys'] });

		expect(giftFieldDiffs(before, after, lookups)).toEqual([
			{
				field: GIFT_DIFF_FIELD.category,
				before: 'Knihy, Hračky',
				after: 'Hry, Knihy, Hračky',
			},
		]);
	});

	it('reports a changed primary even when the same categories are kept', () => {
		const before = gift({ categoryIds: ['cat-books', 'cat-toys'] });
		const after = gift({ categoryIds: ['cat-toys', 'cat-books'] });

		expect(giftFieldDiffs(before, after, lookups)).toEqual([
			{ field: GIFT_DIFF_FIELD.category, before: 'Knihy, Hračky', after: 'Hračky, Knihy' },
		]);
	});

	it('reports links by what was removed and what was added', () => {
		const before = gift({ links: [{ url: 'https://old.example/duna' }] });
		const after = gift({ links: [{ url: 'https://new.example/duna', label: 'Akce' }] });

		expect(giftFieldDiffs(before, after, lookups)).toEqual([
			{ field: GIFT_DIFF_FIELD.link, before: 'old.example', after: null },
			{ field: GIFT_DIFF_FIELD.link, before: null, after: 'new.example · Akce' },
		]);
	});

	it('describes image and received changes in words', () => {
		const before = gift();
		const after = gift({ imageUrl: 'https://img.example/duna.jpg', received: true });

		expect(giftFieldDiffs(before, after, lookups)).toEqual([
			{
				field: GIFT_DIFF_FIELD.image,
				before: m.change_review_image_none(),
				after: m.change_review_image_new(),
			},
			{
				field: GIFT_DIFF_FIELD.received,
				before: m.change_review_received_no(),
				after: m.change_review_received_yes(),
			},
		]);
	});
});

describe('gift cards and appends', () => {
	it('shows cards for new and deleted gifts and for edits that change the card', () => {
		const before = gift();
		const renamed = gift({ name: 'Duna' });
		const described = gift({ description: 'Vázané vydání' });

		expect(showsGiftCards(null, before, [])).toBe(true);
		expect(showsGiftCards(before, { ...before, deleted: true }, [])).toBe(true);
		expect(showsGiftCards(before, renamed, giftFieldDiffs(before, renamed, lookups))).toBe(
			true,
		);
		expect(showsGiftCards(before, described, giftFieldDiffs(before, described, lookups))).toBe(
			false,
		);
	});

	it('returns only the appends a change adds after the existing ones', () => {
		const existing = { text: 'Modrá', addedAt: '2026-10-01T10:00:00.000Z' };
		const added = { text: 'Velikost L', addedAt: '2026-10-02T10:00:00.000Z' };

		expect(
			appendedDescriptions(
				gift({ descriptionAppends: [existing] }),
				gift({ descriptionAppends: [existing, added] }),
			),
		).toEqual([added]);
	});
});

describe('reorder moves', () => {
	const currentGifts = ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id.toUpperCase() }));

	it('lists only the moved gift when one gift moves, with its new neighbours', () => {
		expect(reorderMoves(['b', 'c', 'a', 'd'], currentGifts)).toEqual([
			{
				giftId: 'a',
				name: 'A',
				fromPosition: 1,
				toPosition: 3,
				previousName: 'C',
				nextName: 'D',
			},
		]);
	});

	it('lists nothing when the order is unchanged and skips gifts that no longer exist', () => {
		expect(reorderMoves(['a', 'gone', 'b', 'c', 'd'], currentGifts)).toEqual([]);
	});
});
