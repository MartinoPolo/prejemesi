import * as m from '$lib/paraglide/messages.js';
import { getLocale } from '$lib/paraglide/runtime.js';
import { extractGiftUrlDomain, getPrimaryGiftLink } from './gift_url.js';
import type { GiftLink } from './types.js';
import type { WishlistRole } from '$lib/modules/wishlists/types.js';

/**
 * Format a price with currency symbol. When `priceMax` is a distinct, larger value, renders a
 * locale-correct range via `Intl.NumberFormat.formatRange` (currency shown once, e.g.
 * "1 200–1 500 Kč") — a non-binding hint, never an approximate/"cca" marker (issue #155).
 */
export function formatPrice(
	price: number | null,
	currency: string | null,
	priceMax?: number | null,
): string {
	if (price === null) {
		return m.gift_price_not_listed();
	}

	const currencyCode = currency ?? 'CZK';
	const isRange = priceMax !== undefined && priceMax !== null && priceMax > price;
	try {
		const formatter = new Intl.NumberFormat(getLocale(), {
			style: 'currency',
			currency: currencyCode,
			minimumFractionDigits: 0,
			maximumFractionDigits: 2,
		});
		return isRange ? formatter.formatRange(price, priceMax) : formatter.format(price);
	} catch {
		return isRange ? `${price}–${priceMax} ${currencyCode}` : `${price} ${currencyCode}`;
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

export function getPriorityKey(label: string | null): PriorityKey | null {
	return label !== null && label in PRIORITY_DISPLAY ? (label as PriorityKey) : null;
}

export function getPriorityDisplay(
	label: string | null,
): (typeof PRIORITY_DISPLAY)[PriorityKey] | null {
	const key = getPriorityKey(label);
	return key === null ? null : PRIORITY_DISPLAY[key];
}

/**
 * Small line naming who reserved a gift, e.g. „rezervoval(a) Babička". Shown to
 * moderators only (issue #198) — the API already omits names for everyone else
 * (visitors, recipient), so this returns null exactly when nothing may be shown.
 */
export function formatReserverLine(reserverNames: readonly string[]): string | null {
	const firstName = reserverNames[0];
	if (firstName === undefined) {
		return null;
	}
	if (reserverNames.length === 1) {
		return m.gift_reserved_by({ name: firstName });
	}

	let joinedNames: string;
	try {
		joinedNames = new Intl.ListFormat(getLocale(), {
			style: 'long',
			type: 'conjunction',
		}).format(reserverNames);
	} catch {
		joinedNames = reserverNames.join(', ');
	}
	return m.gift_reserved_by_many({ names: joinedNames });
}

/** Format an ISO timestamp from a description append as a short locale date. */
export function formatAppendDate(iso: string): string {
	return new Intl.DateTimeFormat(getLocale(), {
		day: 'numeric',
		month: 'numeric',
		year: 'numeric',
	}).format(new Date(iso));
}

/** Derive the increment for a gift price from its current order of magnitude. */
export function getGiftPriceMagnitude(price: number | null): number {
	if (price === null || !Number.isFinite(price) || price < 10) {
		return 1;
	}
	return 10 ** Math.floor(Math.log10(price));
}

/** Apply one keyboard increment without snapping an off-grid decimal to the native step grid. */
export function adjustGiftPriceByMagnitude(price: number | null, direction: 1 | -1): number {
	const current = price !== null && Number.isFinite(price) ? price : 0;
	const magnitude = getGiftPriceMagnitude(current);
	const fractionalDigits = current.toString().split('.')[1]?.length ?? 0;
	const scale = 10 ** fractionalDigits;
	const adjusted = (Math.round(current * scale) + direction * magnitude * scale) / scale;
	return Math.max(0, adjusted);
}

/**
 * Finalize a gift form's price `$state` for submission. Number-typed price
 * state goes `NaN`/`null` when the user clears a bound `<input type="number">`
 * (Svelte's numeric binding never yields `''`); this always resolves to a
 * finite price or `null`, never `NaN`, so it can never fail server validation.
 */
export function finalizeGiftPrice(price: number | null): number | null {
	return Number.isFinite(price) ? price : null;
}

/**
 * Finalize a gift form's quantity `$state` for submission. Same `NaN`/`null`
 * risk as {@link finalizeGiftPrice}; falls back to the default quantity of 1
 * when blank/invalid, matching the server's minimum of 1.
 */
export function finalizeGiftQuantity(quantity: number): number {
	return Number.isFinite(quantity) && quantity >= 1 ? quantity : 1;
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

	// Recipient NEVER sees reserved info (their own surprise)
	if (role === 'recipient') {
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
