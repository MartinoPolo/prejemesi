import * as m from '$lib/paraglide/messages.js';
import { getLocale } from '$lib/paraglide/runtime.js';
import { extractGiftUrlDomain, getPrimaryGiftLink } from './gift_url.js';
import type { GiftLink } from './types.js';
import type { WishlistRole } from '$lib/modules/wishlists/types.js';

/** Format price with currency symbol */
export function formatPrice(price: number | null, currency: string | null): string {
	if (price === null) {
		return m.gift_price_not_listed();
	}

	const currencyCode = currency ?? 'CZK';
	try {
		return new Intl.NumberFormat(getLocale(), {
			style: 'currency',
			currency: currencyCode,
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		}).format(price);
	} catch {
		return `${price} ${currencyCode}`;
	}
}

/** Extract the display domain of a gift's primary link (`links[0]`). */
export function extractGiftDomain(links: readonly GiftLink[] | null | undefined): string | null {
	return extractGiftUrlDomain(getPrimaryGiftLink(links)?.url ?? null);
}

/** @public Priority label display */
export const PRIORITY_DISPLAY = {
	Vysoka: {
		label: () => m.gift_priority_high(),
		colorClass:
			'bg-[oklch(0.92_0.06_25)] text-[oklch(0.45_0.15_25)] dark:bg-[oklch(0.28_0.05_25)] dark:text-[oklch(0.78_0.1_25)]',
	},
	Stredni: {
		label: () => m.gift_priority_medium(),
		colorClass:
			'bg-[oklch(0.93_0.05_75)] text-[oklch(0.50_0.12_75)] dark:bg-[oklch(0.28_0.04_75)] dark:text-[oklch(0.78_0.08_75)]',
	},
	Nizka: { label: () => m.gift_priority_low(), colorClass: 'bg-muted text-muted-foreground' },
} as const;

export type PriorityKey = keyof typeof PRIORITY_DISPLAY;

export function getPriorityDisplay(
	label: string | null,
): (typeof PRIORITY_DISPLAY)[PriorityKey] | null {
	if (label === null) {
		return null;
	}
	if (label in PRIORITY_DISPLAY) {
		return PRIORITY_DISPLAY[label as PriorityKey];
	}
	return null;
}

/** Format an ISO timestamp from a description append as a short locale date. */
export function formatAppendDate(iso: string): string {
	return new Intl.DateTimeFormat(getLocale(), {
		day: 'numeric',
		month: 'numeric',
		year: 'numeric',
	}).format(new Date(iso));
}

/** Select Czech plural category for count. */
export function czechPluralCategory(count: number): 'one' | 'few' | 'other' {
	if (count === 1) {
		return 'one';
	}
	if (count >= 2 && count <= 4) {
		return 'few';
	}
	return 'other';
}

/**
 * Format piece count with optional reserved suffix.
 * Owner NEVER sees the reserved portion -- only the bare piece count.
 * Returns null when quantity is null.
 */
export function formatPieceCount(
	quantity: number | null,
	role: WishlistRole,
	reservedCount?: number,
): { pieceText: string; reservedText: string | null } | null {
	if (quantity === null) {
		return null;
	}

	const category = czechPluralCategory(quantity);
	const pieceText =
		category === 'one'
			? m.gift_piece_count_one()
			: category === 'few'
				? m.gift_piece_count_few({ count: quantity })
				: m.gift_piece_count_other({ count: quantity });

	// Owner NEVER sees reserved info
	if (role === 'owner') {
		return { pieceText, reservedText: null };
	}

	// Visitor/moderator: append reserved suffix when reservedCount > 0
	const reserved = reservedCount ?? 0;
	if (reserved <= 0) {
		return { pieceText, reservedText: null };
	}

	const isFullyReserved = reserved >= quantity;
	const reservedText = isFullyReserved
		? m.gift_reserved_fully()
		: m.gift_reserved_count({ count: reserved });

	return { pieceText, reservedText };
}
