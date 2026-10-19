import { describe, expect, it } from 'vitest';
import { CHANGE_DECISION, CHANGE_FIELD } from './change_field_decisions.js';
import {
	ROW_REVIEW_KIND,
	changeRowDecisions,
	fieldEditInput,
	includedRowCount,
	initialChangeReview,
	isGiftDropped,
	reviewedChangeFields,
	unresolvedChangeCount,
	wholeGiftPressed,
	withEveryRowDecided,
	withFieldDecisionToggled,
	withFieldEdited,
	withRowChoiceToggled,
	withRowDecided,
} from './change_review_decisions.js';
import {
	CHANGE_KIND,
	CHANGE_ROW_STATUS,
	type ChangeProposalGift,
	type ChangeProposalRowView,
} from './types.js';

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
		categoryId: null,
		received: false,
		deleted: false,
		editedAfterShareAt: null,
		...overrides,
	};
}

function reviewRow(
	overrides: Partial<ChangeProposalRowView> & Pick<ChangeProposalRowView, 'rowId'>,
): ChangeProposalRowView {
	return {
		operation: 'updateGift',
		kind: CHANGE_KIND.giftEdit,
		input: {},
		requiresConfirmation: false,
		status: CHANGE_ROW_STATUS.ready,
		error: null,
		conflicts: [],
		preview: null,
		appliedResult: null,
		appliedFields: null,
		...overrides,
	};
}

const newGift = reviewRow({
	rowId: 'new',
	operation: 'createGift',
	kind: CHANGE_KIND.giftCreation,
	input: { name: 'Stolní hra Azul', price: 1290, currency: 'CZK' },
});
const edit = reviewRow({
	rowId: 'edit',
	input: { id: 'g-duna', name: 'Kniha Duna', quantity: 2, price: 450, currency: 'CZK' },
	preview: {
		gifts: [
			{
				giftId: 'g-duna',
				before: gift(),
				after: gift({ quantity: 2, price: 450, currency: 'CZK' }),
			},
		],
		result: null,
	},
});
const deletion = reviewRow({
	rowId: 'deletion',
	operation: 'deleteGift',
	kind: CHANGE_KIND.giftDeletion,
	input: { giftId: 'g-lego' },
	requiresConfirmation: true,
	status: CHANGE_ROW_STATUS.needsConfirmation,
});
const conflict = reviewRow({ rowId: 'conflict', status: CHANGE_ROW_STATUS.conflict });
const rejected = reviewRow({
	rowId: 'rejected',
	status: CHANGE_ROW_STATUS.rejected,
	error: { status: 403, code: 'CANNOT_EDIT_AFTER_SHARING', details: {} },
});
const rows = [newGift, edit, deletion, conflict, rejected];

describe('change review decisions', () => {
	it('starts edits and new gifts accepted, leaves a deletion unresolved and skips rows that never apply', () => {
		const review = initialChangeReview(rows);

		expect(Object.keys(review)).toEqual(['new', 'edit', 'deletion']);
		expect(review.deletion).toEqual({ kind: ROW_REVIEW_KIND.whole, accepted: null });
		expect(wholeGiftPressed(review.new, CHANGE_DECISION.accepted)).toBe('true');
		expect(wholeGiftPressed(review.edit, CHANGE_DECISION.accepted)).toBe('true');
		expect(unresolvedChangeCount(review)).toBe(1);
	});

	it('reviews only the fields that change the gift', () => {
		expect(reviewedChangeFields(edit)).toEqual([CHANGE_FIELD.price, CHANGE_FIELD.quantity]);
	});

	it('never resolves a deletion with the global accept, but declines it with the global reject', () => {
		const initial = initialChangeReview(rows);
		const rejectedAll = withEveryRowDecided(initial, rows, CHANGE_DECISION.rejected);

		expect(rejectedAll.deletion).toEqual({ kind: ROW_REVIEW_KIND.whole, accepted: false });
		expect(includedRowCount(rejectedAll)).toBe(0);

		const unresolvedDeletion = withRowChoiceToggled(rejectedAll, 'deletion', false);
		const acceptedAll = withEveryRowDecided(unresolvedDeletion, rows, CHANGE_DECISION.accepted);
		expect(acceptedAll.deletion).toEqual({ kind: ROW_REVIEW_KIND.whole, accepted: null });
		expect(includedRowCount(acceptedAll)).toBe(2);
	});

	it('clears a field back to unresolved when its active choice is pressed again', () => {
		const initial = initialChangeReview(rows);
		const cleared = withFieldDecisionToggled(
			initial,
			'edit',
			CHANGE_FIELD.quantity,
			CHANGE_DECISION.accepted,
		);

		expect(unresolvedChangeCount(cleared)).toBe(2);
		expect(wholeGiftPressed(cleared.edit, CHANGE_DECISION.accepted)).toBe('mixed');
	});

	it('drops a new gift once every other field is rejected and keeps it when one is accepted again', () => {
		const initial = initialChangeReview(rows);
		const priceRejected = withFieldDecisionToggled(
			initial,
			'new',
			CHANGE_FIELD.price,
			CHANGE_DECISION.rejected,
		);

		expect(isGiftDropped(priceRejected.new)).toBe(true);
		expect(changeRowDecisions([newGift], priceRejected)).toEqual([
			{ rowId: 'new', decision: CHANGE_DECISION.rejected },
		]);

		const nameAccepted = withFieldDecisionToggled(
			priceRejected,
			'new',
			CHANGE_FIELD.name,
			CHANGE_DECISION.accepted,
		);
		expect(isGiftDropped(nameAccepted.new)).toBe(false);
		expect(wholeGiftPressed(nameAccepted.new, CHANGE_DECISION.accepted)).toBe('true');
	});

	it('sends the accepted fields with the reviewer’s own values and rejects every other row', () => {
		let review = initialChangeReview(rows);
		review = withFieldEdited(review, 'edit', CHANGE_FIELD.price, {
			price: 390,
			priceMax: null,
		});
		review = withFieldDecisionToggled(
			review,
			'edit',
			CHANGE_FIELD.quantity,
			CHANGE_DECISION.rejected,
		);
		review = withRowDecided(review, 'deletion', CHANGE_DECISION.accepted);

		expect(changeRowDecisions(rows, review)).toEqual([
			{ rowId: 'new', decision: CHANGE_DECISION.accepted },
			{
				rowId: 'edit',
				decision: CHANGE_DECISION.accepted,
				fields: {
					price: { decision: 'edited', input: { price: 390, priceMax: null } },
					quantity: { decision: 'rejected' },
				},
			},
			{ rowId: 'deletion', decision: CHANGE_DECISION.accepted },
			{ rowId: 'conflict', decision: CHANGE_DECISION.rejected },
			{ rowId: 'rejected', decision: CHANGE_DECISION.rejected },
		]);
	});

	it('keeps the reviewer’s edit when the whole gift is accepted after a partial reject', () => {
		let review = initialChangeReview(rows);
		review = withFieldEdited(review, 'edit', CHANGE_FIELD.price, {
			price: 390,
			priceMax: null,
		});
		review = withFieldDecisionToggled(
			review,
			'edit',
			CHANGE_FIELD.quantity,
			CHANGE_DECISION.rejected,
		);
		review = withRowDecided(review, 'edit', CHANGE_DECISION.accepted);

		expect(changeRowDecisions([edit], review)).toEqual([
			{
				rowId: 'edit',
				decision: CHANGE_DECISION.accepted,
				fields: { price: { decision: 'edited', input: { price: 390, priceMax: null } } },
			},
		]);
	});
});

describe('field edit input', () => {
	it('turns a price edit into one price, clearing a proposed range and keeping the currency', () => {
		const proposed = { price: 400, priceMax: 600, currency: 'EUR' };

		expect(fieldEditInput(CHANGE_FIELD.price, '450,50', proposed)).toEqual({
			price: 450.5,
			priceMax: null,
			currency: 'EUR',
		});
		expect(fieldEditInput(CHANGE_FIELD.price, '', proposed)).toEqual({
			price: null,
			priceMax: null,
			currency: 'EUR',
		});
	});

	it('refuses an invalid price, quantity or name and any edit of links', () => {
		expect(fieldEditInput(CHANGE_FIELD.price, '-5', {})).toBeNull();
		expect(fieldEditInput(CHANGE_FIELD.price, '1.234', {})).toBeNull();
		expect(fieldEditInput(CHANGE_FIELD.quantity, '0', {})).toBeNull();
		expect(fieldEditInput(CHANGE_FIELD.quantity, '1.5', {})).toBeNull();
		expect(fieldEditInput(CHANGE_FIELD.name, '   ', {})).toBeNull();
		expect(fieldEditInput(CHANGE_FIELD.links, 'https://example.com', {})).toBeNull();
	});
});
