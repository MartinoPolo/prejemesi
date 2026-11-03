import type { GiftByRole } from '$lib/modules/gifts/types.js';
import { giftSectionHasHeader, type GiftSection } from '$lib/modules/gifts/gift_ordering.js';

export const GIFT_DISPLAY_ROW_KINDS = {
	header: 'header',
	dropZone: 'dropZone',
	gift: 'gift',
} as const;

export type GiftDisplayRow =
	| { kind: typeof GIFT_DISPLAY_ROW_KINDS.header; key: string; section: GiftSection }
	| { kind: typeof GIFT_DISPLAY_ROW_KINDS.dropZone; key: string; section: GiftSection }
	| {
			kind: typeof GIFT_DISPLAY_ROW_KINDS.gift;
			key: string;
			section: GiftSection;
			gift: GiftByRole;
			/** Position in the flattened section order — the index the reorder controller reports. */
			index: number;
			indexInSection: number;
	  };

/**
 * Flattens sections into one keyed row list so a gift keeps its DOM element when it moves to
 * another section (grouped reorder previews a cross-group drag live). Empty sections render only
 * when `includeDropZones` is set, as a header plus a drop zone.
 */
export function toGiftDisplayRows(
	sections: readonly GiftSection[],
	includeDropZones = false,
): GiftDisplayRow[] {
	const rows: GiftDisplayRow[] = [];
	let index = 0;
	for (const section of sections) {
		if (section.gifts.length === 0 && !includeDropZones) {
			continue;
		}
		if (giftSectionHasHeader(section)) {
			rows.push({
				kind: GIFT_DISPLAY_ROW_KINDS.header,
				key: `header:${section.key}`,
				section,
			});
		}
		if (section.gifts.length === 0) {
			rows.push({
				kind: GIFT_DISPLAY_ROW_KINDS.dropZone,
				key: `zone:${section.key}`,
				section,
			});
		}
		section.gifts.forEach((gift, indexInSection) => {
			rows.push({
				kind: GIFT_DISPLAY_ROW_KINDS.gift,
				key: gift.id,
				section,
				gift,
				index: index++,
				indexInSection,
			});
		});
	}
	return rows;
}

/** Total gift count across all sections — the flat displayedGifts length (issue #224). */
export function countGiftsInSections(sections: readonly GiftSection[]): number {
	return sections.reduce((sum, section) => sum + section.gifts.length, 0);
}

type GiftDisplayGiftRow = Extract<GiftDisplayRow, { kind: typeof GIFT_DISPLAY_ROW_KINDS.gift }>;

export interface GiftCarouselRow {
	key: string;
	/** The section whose header introduces the row; a headerless one gets a count-only header. */
	section: GiftSection;
	giftRows: GiftDisplayGiftRow[];
}

/**
 * Splits display rows into one Carousel row per section header. A headerless section joins the
 * row before it, matching how its gifts flow under that header in the Card grid, so a list
 * without headers is one row.
 */
export function toGiftCarouselRows(displayRows: readonly GiftDisplayRow[]): GiftCarouselRow[] {
	const carouselRows: GiftCarouselRow[] = [];
	for (const row of displayRows) {
		if (row.kind !== GIFT_DISPLAY_ROW_KINDS.gift) {
			continue;
		}
		const currentRow = carouselRows.at(-1);
		const startsRow =
			currentRow === undefined ||
			(giftSectionHasHeader(row.section) && currentRow.section.key !== row.section.key);
		if (startsRow) {
			carouselRows.push({ key: row.section.key, section: row.section, giftRows: [row] });
		} else {
			currentRow.giftRows.push(row);
		}
	}
	return carouselRows;
}
