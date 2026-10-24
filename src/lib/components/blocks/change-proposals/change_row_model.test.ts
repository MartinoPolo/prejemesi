import { describe, expect, it } from 'vitest';
import { CHANGE_FIELD } from '$lib/modules/change_proposals/change_field_decisions.js';
import {
	fieldEditInput,
	initialChangeReview,
	withFieldEdited,
} from '$lib/modules/change_proposals/change_review_decisions.js';
import {
	CHANGE_KIND,
	CHANGE_ROW_STATUS,
	type ChangeProposalGift,
	type ChangeProposalRowView,
} from '$lib/modules/change_proposals/types.js';
import type { PublicGiftCategory } from '$lib/modules/gift-categories/types.js';
import {
	GIFT_LIVE_PREVIEW,
	buildChangeRowModel,
	giftLabelLookups,
	type ChangeRowContext,
} from './change_row_model.js';

function category(id: string, label: string, sortOrder: number): PublicGiftCategory {
	return { id, presetKey: null, customLabel: label, color: '#2563EB', sortOrder };
}

const CATEGORIES = [
	category('books', 'Knihy', 0),
	category('toys', 'Hračky', 1),
	category('games', 'Hry', 2),
	category('music', 'Hudba', 3),
];

const context: ChangeRowContext = {
	currentGifts: [],
	categories: CATEGORIES,
	priorityLevels: [],
	submitterName: 'Asistent',
	kindTitle: () => 'Úprava dárku',
};
const lookups = giftLabelLookups(context, (giftCategory) => giftCategory.customLabel ?? '');

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

function categoryEditRow(
	input: Record<string, unknown>,
	before: string[],
	after: string[],
): ChangeProposalRowView {
	return {
		rowId: 'category',
		operation: 'updateGift',
		kind: CHANGE_KIND.giftEdit,
		input: { id: 'g-duna', ...input },
		requiresConfirmation: false,
		status: CHANGE_ROW_STATUS.ready,
		error: null,
		conflicts: [],
		preview: {
			gifts: [
				{
					giftId: 'g-duna',
					before: gift({ categoryIds: before }),
					after: gift({ categoryIds: after }),
				},
			],
			result: null,
		},
		appliedResult: null,
		appliedFields: null,
	};
}

function categoryField(row: ChangeProposalRowView, review = initialChangeReview([row])) {
	const model = buildChangeRowModel(row, context, lookups, review[row.rowId]);
	return {
		field: model.giftChanges[0]?.fields.find(
			(candidate) => candidate.field === CHANGE_FIELD.category,
		),
		livePreview: model.giftChanges[0]?.livePreview,
	};
}

function previewedCategories(livePreview: ReturnType<typeof categoryField>['livePreview']) {
	if (livePreview?.kind !== GIFT_LIVE_PREVIEW.edit) {
		return null;
	}
	return {
		categoryIds: livePreview.changes.categoryIds,
		categories: livePreview.changes.categories?.map((giftCategory) => giftCategory.id),
	};
}

describe('change row category field', () => {
	it('shows the category labels joined in order, primary first', () => {
		const row = categoryEditRow(
			{ categoryIds: ['toys', 'books'] },
			['books'],
			['toys', 'books'],
		);

		expect(categoryField(row).field?.diffs).toEqual([
			expect.objectContaining({ before: 'Knihy', after: 'Hračky, Knihy' }),
		]);
	});

	it('opens the editor at the proposed primary with every category and none to choose from', () => {
		const row = categoryEditRow(
			{ categoryIds: ['toys', 'books'] },
			['books'],
			['toys', 'books'],
		);
		const editor = categoryField(row).field?.editor;

		expect(editor?.text).toBe('toys');
		expect(editor?.options.map((option) => option.value)).toEqual([
			'',
			'books',
			'toys',
			'games',
			'music',
		]);
	});

	it('previews the proposed categories in order on the live gift', () => {
		const row = categoryEditRow(
			{ categoryIds: ['toys', 'books'] },
			['books'],
			['toys', 'books'],
		);

		expect(previewedCategories(categoryField(row).livePreview)).toEqual({
			categoryIds: ['toys', 'books'],
			categories: ['toys', 'books'],
		});
	});

	it('previews the reviewer’s primary pick in place of the first proposed category', () => {
		const proposedInput = { categoryIds: ['toys', 'books', 'games'] };
		const row = categoryEditRow(proposedInput, ['books'], ['toys', 'books', 'games']);
		const review = withFieldEdited(
			initialChangeReview([row]),
			row.rowId,
			CHANGE_FIELD.category,
			fieldEditInput(CHANGE_FIELD.category, 'music', { id: 'g-duna', ...proposedInput }),
		);

		expect(previewedCategories(categoryField(row, review).livePreview)).toEqual({
			categoryIds: ['music', 'books', 'games'],
			categories: ['music', 'books', 'games'],
		});
	});

	it('previews a reviewer’s pick on a legacy categoryId proposal as replacing only the primary', () => {
		const proposedInput = { categoryId: 'toys' };
		const row = categoryEditRow(proposedInput, ['books', 'games'], ['toys', 'games']);
		const review = withFieldEdited(
			initialChangeReview([row]),
			row.rowId,
			CHANGE_FIELD.category,
			fieldEditInput(CHANGE_FIELD.category, 'music', { id: 'g-duna', ...proposedInput }),
		);

		expect(previewedCategories(categoryField(row, review).livePreview)).toEqual({
			categoryIds: ['music', 'games'],
			categories: ['music', 'games'],
		});
	});

	it('previews no categories when the reviewer picks none', () => {
		const proposedInput = { categoryIds: ['toys', 'books'] };
		const row = categoryEditRow(proposedInput, ['books'], ['toys', 'books']);
		const review = withFieldEdited(
			initialChangeReview([row]),
			row.rowId,
			CHANGE_FIELD.category,
			fieldEditInput(CHANGE_FIELD.category, '', { id: 'g-duna', ...proposedInput }),
		);

		expect(previewedCategories(categoryField(row, review).livePreview)).toEqual({
			categoryIds: [],
			categories: [],
		});
	});
});
