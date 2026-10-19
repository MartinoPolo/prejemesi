import {
	CHANGE_KIND,
	CHANGE_PROPOSAL_STATE,
	CHANGE_ROW_STATUS,
	type ChangeProposalGift,
	type ChangeProposalRowView,
	type ChangeProposalView,
} from '$lib/modules/change_proposals/types.js';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';

const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;

function proposalGift(overrides: Partial<ChangeProposalGift> = {}): ChangeProposalGift {
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

function proposalRow(
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
		...overrides,
	};
}

/** Two ordinary rows, a deletion awaiting confirmation and a row the dry run rejected. */
function proposalRows(): ChangeProposalRowView[] {
	const lego = proposalGift({ name: 'Lego Titanic' });
	return [
		proposalRow({
			rowId: 'r1',
			operation: 'createGift',
			kind: CHANGE_KIND.giftCreation,
			preview: {
				gifts: [
					{
						giftId: 'g-new',
						before: null,
						after: proposalGift({ name: 'Stolní hra Azul' }),
					},
				],
				result: null,
			},
		}),
		proposalRow({
			rowId: 'r2',
			input: { id: 'g-duna' },
			preview: {
				gifts: [
					{
						giftId: 'g-duna',
						before: proposalGift(),
						after: proposalGift({ name: 'Kniha Duna (brožovaná)' }),
					},
				],
				result: null,
			},
		}),
		proposalRow({
			rowId: 'r3',
			operation: 'deleteGift',
			kind: CHANGE_KIND.giftDeletion,
			input: { giftId: 'g-lego' },
			requiresConfirmation: true,
			status: CHANGE_ROW_STATUS.needsConfirmation,
			preview: {
				gifts: [{ giftId: 'g-lego', before: lego, after: { ...lego, deleted: true } }],
				result: null,
			},
		}),
		proposalRow({
			rowId: 'r4',
			input: { id: 'g-shared', name: 'Parfém' },
			status: CHANGE_ROW_STATUS.rejected,
			error: { status: 403, code: 'CANNOT_EDIT_AFTER_SHARING', details: {} },
		}),
	];
}

export function changeProposal(overrides: Partial<ChangeProposalView> = {}): ChangeProposalView {
	const now = Date.now();
	const rows = overrides.rows ?? proposalRows();
	return {
		id: 'proposal-1',
		state: CHANGE_PROPOSAL_STATE.pending,
		wishlistShortId: 'bday2026',
		reviewUrl: '/w/bday2026/changes/proposal-1',
		submitterName: 'Martin Novák',
		viewerRole: WISHLIST_ROLES.recipient,
		channel: 'token',
		tokenName: 'Claude – nákupní asistent',
		viaApp: false,
		tokenRevoked: false,
		createdAt: new Date(now - DAY_MILLISECONDS),
		expiresAt: new Date(now + 6 * DAY_MILLISECONDS),
		appliedAt: null,
		discardedAt: null,
		undoneAt: null,
		rowCount: rows.length,
		kindCounts: { giftCreation: 1, giftEdit: 2, giftDeletion: 1 },
		undo: null,
		...overrides,
		rows,
	};
}

/** The fixture after Apply with the ordinary rows: they applied, the rest did not. */
export function appliedChangeProposal(
	overrides: Partial<ChangeProposalView> = {},
): ChangeProposalView {
	const appliedRowIds = new Set(['r1', 'r2']);
	return changeProposal({
		state: CHANGE_PROPOSAL_STATE.applied,
		appliedAt: new Date(),
		undo: { available: true, blockingRowIds: [] },
		rows: proposalRows().map((row) => ({
			...row,
			status: appliedRowIds.has(row.rowId)
				? CHANGE_ROW_STATUS.applied
				: CHANGE_ROW_STATUS.notApplied,
		})),
		...overrides,
	});
}
