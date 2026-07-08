import type { DetectedColumn } from '$lib/modules/import/detect_columns.js';
import { COLUMN_ROLE } from '$lib/modules/import/detect_columns.js';
import type { GiftDraft } from '$lib/modules/gifts/gift_draft.js';
import { parsePrice } from '$lib/modules/gifts/gift_draft.js';
import { DEFAULT_DRAFT_PRIORITY, DEFAULT_GIFT_CURRENCY } from '$lib/modules/gifts/types.js';

/**
 * Build {@link GiftDraft} rows from parsed data rows + detected column mapping.
 *
 * Each row becomes one draft. 'name' → name, 'notes' → description, 'url' →
 * collected into links[], 'price' → parsed via parsePrice(). 'bool' and
 * 'ignore' columns are skipped (per DECISIONS.md: taken/vybráno column ignored).
 */
export function buildDraftRows(
	dataRows: readonly string[][],
	columns: readonly DetectedColumn[],
): GiftDraft[] {
	return dataRows.map((row) => {
		let name = '';
		let description: string | null = null;
		let price: number | null = null;
		let currency = DEFAULT_GIFT_CURRENCY;
		const links: { url: string }[] = [];

		for (const column of columns) {
			const cellValue = row[column.index] ?? '';
			if (cellValue.trim() === '') {
				continue;
			}

			switch (column.role) {
				case COLUMN_ROLE.name:
					name = cellValue;
					break;
				case COLUMN_ROLE.notes:
					description = cellValue;
					break;
				case COLUMN_ROLE.url:
					links.push({ url: cellValue });
					break;
				case COLUMN_ROLE.price: {
					const parsed = parsePrice(cellValue);
					price = parsed.price;
					currency = parsed.currency;
					break;
				}
				case COLUMN_ROLE.bool:
				case COLUMN_ROLE.ignore:
					// Intentionally skipped
					break;
			}
		}

		return { name, description, links, price, currency, priority: DEFAULT_DRAFT_PRIORITY };
	});
}
