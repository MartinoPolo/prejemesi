import type { GiftByRole } from '$lib/modules/gifts/types.js';
import type { GiftSection } from '$lib/modules/gifts/gift_ordering.js';

export interface IndexedGift {
	gift: GiftByRole;
	/** Position in the flattened section order — the index the reorder controller reports. */
	index: number;
}

export interface IndexedSection {
	section: GiftSection;
	items: IndexedGift[];
}

/**
 * Annotates each gift with its running global index across all sections, so the card/list views
 * can render section headers while keeping reorder indices aligned with the flat displayedGifts
 * order (issue #224).
 */
export function toIndexedSections(sections: readonly GiftSection[]): IndexedSection[] {
	let index = 0;
	return sections.map((section) => ({
		section,
		items: section.gifts.map((gift) => ({ gift, index: index++ })),
	}));
}

/** Total gift count across all sections — the flat displayedGifts length (issue #224). */
export function countGiftsInSections(sections: readonly GiftSection[]): number {
	return sections.reduce((sum, section) => sum + section.gifts.length, 0);
}

/**
 * Stable `#each` key for a rendered section: structural key plus first gift id keeps grid and
 * list views from re-keying identically-shaped sections when only membership shifts.
 */
export function sectionRenderKey(section: GiftSection, items: readonly IndexedGift[]): string {
	return `${section.key}:${items[0]?.gift.id ?? ''}`;
}
