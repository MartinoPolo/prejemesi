import * as m from '$lib/paraglide/messages.js';
import { getLocale } from '$lib/paraglide/runtime.js';

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

/** Extract domain from URL for display */
export function extractDomain(url: string | null): string | null {
	if (url === null || url === '') {
		return null;
	}
	try {
		const parsed = new URL(url);
		return parsed.hostname.replace(/^www\./, '');
	} catch {
		return null;
	}
}

/** Priority label display */
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
