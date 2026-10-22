import type { GiftByRole, GiftForRecipient } from '$lib/modules/gifts/types.js';
import { GIFT_LIVE_PREVIEW, type GiftLivePreviewKind } from './change_row_model.js';
import type { ReviewRowEntry } from './change_review_rows.js';

/** A pending proposal card's rows, read live as decisions change. */
export interface DecidingProposal {
	proposalId: string;
	entries: () => readonly ReviewRowEntry[];
}

/**
 * One registration per card: the live turn's card and the stored copy of the same proposal
 * overlap for a moment, and either may unmount first without dropping the other's preview.
 */
export type DecidingProposals = ReadonlySet<DecidingProposal>;
/** Where each pending proposal card registers its rows while it is being decided. */
export type DecidingProposalRegistry = Set<DecidingProposal>;

/** What the wishlist shows while proposals are decided; only the deciding user sees it. */
export interface GiftLivePreviews {
	edits: ReadonlyMap<string, Partial<GiftForRecipient>>;
	deletions: ReadonlySet<string>;
	creations: readonly { key: string; gift: GiftForRecipient }[];
}

export const NO_GIFT_LIVE_PREVIEWS: GiftLivePreviews = {
	edits: new Map(),
	deletions: new Set(),
	creations: [],
};

/** Every deciding proposal's previews; edits of one gift from several proposals combine in order. */
export function giftLivePreviews(proposals: DecidingProposals): GiftLivePreviews {
	if (proposals.size === 0) {
		return NO_GIFT_LIVE_PREVIEWS;
	}
	const edits = new Map<string, Partial<GiftForRecipient>>();
	const deletions = new Set<string>();
	const creations: { key: string; gift: GiftForRecipient }[] = [];
	const latestEntries = new Map<string, DecidingProposal['entries']>();
	for (const { proposalId, entries } of proposals) {
		latestEntries.set(proposalId, entries);
	}
	for (const [proposalId, entries] of latestEntries) {
		for (const entry of entries()) {
			if (entry.blocked) {
				continue;
			}
			for (const change of entry.model.giftChanges) {
				const preview = change.livePreview;
				if (preview === null) {
					continue;
				}
				if (preview.kind === GIFT_LIVE_PREVIEW.deletion) {
					deletions.add(preview.giftId);
				} else if (preview.kind === GIFT_LIVE_PREVIEW.creation) {
					creations.push({ key: `${proposalId}:${preview.giftId}`, gift: preview.gift });
				} else {
					edits.set(preview.giftId, { ...edits.get(preview.giftId), ...preview.changes });
				}
			}
		}
	}
	return { edits, deletions, creations };
}

/** How a gift view marks a preview; a proposed new or deleted gift is not on the list, so it offers no actions. */
export function giftLivePreviewMarks(livePreview: GiftLivePreviewKind | undefined) {
	return {
		deletion: livePreview === GIFT_LIVE_PREVIEW.deletion,
		proposed:
			livePreview === GIFT_LIVE_PREVIEW.edit || livePreview === GIFT_LIVE_PREVIEW.creation,
		actionless: livePreview !== undefined && livePreview !== GIFT_LIVE_PREVIEW.edit,
	};
}

/** A gift as the wishlist shows it during the preview, and how the preview marks it. */
export function previewedGift(
	gift: GiftByRole,
	previews: GiftLivePreviews,
): { gift: GiftByRole; livePreview: GiftLivePreviewKind | undefined } {
	if (previews.deletions.has(gift.id)) {
		return { gift, livePreview: GIFT_LIVE_PREVIEW.deletion };
	}
	const changes = previews.edits.get(gift.id);
	return changes === undefined
		? { gift, livePreview: undefined }
		: { gift: { ...gift, ...changes }, livePreview: GIFT_LIVE_PREVIEW.edit };
}
