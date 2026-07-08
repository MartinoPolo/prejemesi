import { normalizeGiftLinks, normalizeGiftUrl } from './gift_url.js';
import {
	DEFAULT_GIFT_CURRENCY,
	GIFT_CURRENCIES,
	type DraftPriority,
	type GiftCurrency,
	type GiftLink,
} from './types.js';

/** An unsaved, editable gift row in the import/batch draft grid, before commit. */
export interface GiftDraft {
	name: string;
	description: string | null;
	links: GiftLink[];
	price: number | null;
	currency: GiftCurrency;
	priority: DraftPriority;
}

/** Lowercased tokens that map a raw price string to a {@link GiftCurrency}. */
const CURRENCY_TOKENS: ReadonlyArray<{ token: string; currency: GiftCurrency }> = [
	{ token: 'czk', currency: GIFT_CURRENCIES.CZK },
	{ token: 'kč', currency: GIFT_CURRENCIES.CZK },
	{ token: 'kc', currency: GIFT_CURRENCIES.CZK },
	{ token: 'eur', currency: GIFT_CURRENCIES.EUR },
	{ token: '€', currency: GIFT_CURRENCIES.EUR },
	{ token: 'usd', currency: GIFT_CURRENCIES.USD },
	{ token: '$', currency: GIFT_CURRENCIES.USD },
];

function detectCurrency(lowered: string): GiftCurrency {
	for (const { token, currency } of CURRENCY_TOKENS) {
		if (lowered.includes(token)) {
			return currency;
		}
	}
	return DEFAULT_GIFT_CURRENCY;
}

/**
 * Parse a free-form price string into an integer amount and currency. Strips
 * currency symbols/words and thousands separators; a trailing `.`/`,` followed
 * by 1–2 digits is treated as a decimal portion and rounded. Returns
 * `{ price: null }` when no digits are present.
 */
export function parsePrice(raw: string | null | undefined): {
	price: number | null;
	currency: GiftCurrency;
} {
	if (raw === null || raw === undefined) {
		return { price: null, currency: DEFAULT_GIFT_CURRENCY };
	}

	const currency = detectCurrency(raw.toLowerCase());

	// Strip a trailing Czech ",-" / ".-" suffix (whole amount, no decimal).
	let cleaned = raw.replace(/[.,]-\s*$/, '');
	// Drop everything except digits and the `.`,`,`,space separators.
	cleaned = cleaned.replace(/[^\d.,\s]/g, '');

	if (!/\d/.test(cleaned)) {
		return { price: null, currency };
	}

	// A trailing `.`/`,` followed by exactly 1–2 digits is a decimal portion.
	const decimalMatch = cleaned.match(/[.,](\d{1,2})\s*$/);
	let fraction = 0;
	if (decimalMatch) {
		fraction = Number(`0.${decimalMatch[1]}`);
		cleaned = cleaned.slice(0, decimalMatch.index);
	}

	const integerPart = cleaned.replace(/[^\d]/g, '');
	if (integerPart === '') {
		return { price: null, currency };
	}

	return { price: Math.round(Number(integerPart) + fraction), currency };
}

/**
 * Validate a draft (name required) and return a normalized copy: trimmed name,
 * trimmed description (empty → null), and sanitized links.
 */
export function validateDraft(draft: Readonly<GiftDraft>): {
	valid: boolean;
	normalized: GiftDraft;
} {
	const name = draft.name.trim();
	const description = draft.description?.trim();
	return {
		valid: name !== '',
		normalized: {
			name,
			description: description !== undefined && description !== '' ? description : null,
			links: normalizeGiftLinks(draft.links),
			price: draft.price,
			currency: draft.currency,
			priority: draft.priority,
		},
	};
}

/** Normalize a name for duplicate comparison: strip diacritics, lowercase, collapse whitespace. */
function normalizeName(name: string): string {
	return name
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.trim();
}

/** Host+path key for a link (lowercased host without `www.`, path without trailing slash), or null. */
function linkKey(url: string): string | null {
	const normalized = normalizeGiftUrl(url);
	if (normalized === null) {
		return null;
	}
	const parsed = new URL(normalized);
	const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
	const path = parsed.pathname.replace(/\/$/, '');
	return `${host}${path}`;
}

function linkKeys(links: readonly GiftLink[] | null | undefined): Set<string> {
	const keys = new Set<string>();
	for (const link of links ?? []) {
		const key = linkKey(link.url);
		if (key !== null) {
			keys.add(key);
		}
	}
	return keys;
}

/**
 * Find existing gifts that duplicate `draft` by normalized name or by a shared
 * link host+path. Generic so callers passing `Gift[]` get `Gift[]` back. Output
 * preserves input order and contains no duplicates.
 */
export function findDuplicates<T extends { name: string; links?: readonly GiftLink[] | null }>(
	draft: Readonly<GiftDraft>,
	existingGifts: readonly T[],
): T[] {
	const draftName = normalizeName(draft.name);
	const draftKeys = linkKeys(draft.links);

	return existingGifts.filter((existing) => {
		if (draftName !== '' && normalizeName(existing.name) === draftName) {
			return true;
		}
		for (const key of linkKeys(existing.links)) {
			if (draftKeys.has(key)) {
				return true;
			}
		}
		return false;
	});
}
