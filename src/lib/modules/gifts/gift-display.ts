/** Format price with currency symbol */
export function formatPrice(price: number | null, currency: string | null): string {
	if (price === null) {
		return 'Cena neuvedena';
	}

	const currencyCode = currency ?? 'CZK';
	try {
		return new Intl.NumberFormat('cs-CZ', {
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

/** Priority label to Czech display */
export const PRIORITY_DISPLAY = {
	Vysoka: { label: 'Vysoka', colorClass: 'bg-[oklch(0.92_0.06_25)] text-[oklch(0.45_0.15_25)]' },
	Stredni: {
		label: 'Stredni',
		colorClass: 'bg-[oklch(0.93_0.05_75)] text-[oklch(0.50_0.12_75)]',
	},
	Nizka: { label: 'Nizka', colorClass: 'bg-muted text-muted-foreground' },
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
