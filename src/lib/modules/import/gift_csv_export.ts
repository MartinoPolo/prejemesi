import Papa from 'papaparse';
import * as m from '$lib/paraglide/messages.js';
import type { GiftLink } from '$lib/modules/gifts/types.js';

/**
 * Client-side CSV export of a wishlist's gifts, mirroring the import columns so a
 * round-trip works: the headers reuse the importer's role labels (name / notes /
 * link / price) which its header detection classifies back to the same fields.
 *
 * DOMAIN INVARIANT: export gift DATA ONLY. Reservation state (reserved/gifter/
 * bought/received) is never gift-catalog data and never appears here – the
 * recipient must not be able to infer it (DECISIONS.md: owner never sees
 * reservations; import ignores any "taken" column).
 */

/** The gift fields safe to export – reservation/received fields are intentionally absent. */
export interface ExportableGift {
	name: string;
	description: string | null;
	links: GiftLink[];
	price: number | null;
	currency: string | null;
	categoryLabel?: string | null;
}

/** Extra link columns beyond the first reuse the same „Odkaz"/"Link" label with a suffix. */
function linkHeader(index: number): string {
	return index === 0 ? m.import_wizard_role_url() : `${m.import_wizard_role_url()} ${index + 1}`;
}

/**
 * Format a price as the importer parses it: `"{amount} {currency}"`, so
 * {@link parsePrice} recovers both on re-import. Empty when no amount is set.
 */
function formatPrice(gift: ExportableGift): string {
	if (gift.price === null) {
		return '';
	}
	return gift.currency !== null ? `${gift.price} ${gift.currency}` : String(gift.price);
}

/** Build the CSV text for the given gifts. One "link" column per link position present. */
export function buildGiftCsv(gifts: readonly ExportableGift[]): string {
	const maxLinks = gifts.reduce((max, gift) => Math.max(max, gift.links.length), 0);
	const linkHeaders = Array.from({ length: maxLinks }, (_, index) => linkHeader(index));

	const header = [
		m.import_wizard_role_name(),
		m.import_wizard_role_notes(),
		...linkHeaders,
		m.import_wizard_role_price(),
		m.draft_grid_col_category(),
	];

	const rows = gifts.map((gift) => [
		gift.name,
		gift.description ?? '',
		...linkHeaders.map((_, index) => gift.links[index]?.url ?? ''),
		formatPrice(gift),
		gift.categoryLabel ?? '',
	]);

	return Papa.unparse([header, ...rows]);
}

/** Derive a safe CSV filename from the wishlist title, falling back to its short id. */
export function giftCsvFilename(wishlistTitle: string, wishlistShortId: string): string {
	const slug = wishlistTitle
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.trim()
		.replace(/[^a-z0-9]+/gi, '-')
		.replace(/^-+|-+$/g, '')
		.toLowerCase();
	return `${slug === '' ? wishlistShortId : slug}.csv`;
}

/** Trigger a browser download of the CSV text (client-only – uses a Blob object URL). */
export function downloadGiftCsv(csv: string, filename: string): void {
	// Prepend a UTF-8 BOM so Excel opens Czech diacritics correctly; parseTabular strips it.
	const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = filename;
	anchor.click();
	URL.revokeObjectURL(url);
}
