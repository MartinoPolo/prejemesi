/**
 * Column-role detection for parsed tabular data.
 *
 * Given the rows produced by {@link parseTabular}, this finds the header row
 * (if any), skips preamble rows above it and trailing footer/note rows below
 * the data, and classifies every column into a role (name / notes / url / price
 * / bool / ignore). Header labels are authoritative when present; otherwise the
 * column's values are sampled. Perfect classification of messy sheets is not a
 * goal — the editable draft grid is the escape hatch — but clean exports map to
 * near-zero manual effort.
 */

export const COLUMN_ROLE = {
	name: 'name',
	notes: 'notes',
	url: 'url',
	price: 'price',
	bool: 'bool',
	ignore: 'ignore',
} as const;

export type ColumnRole = (typeof COLUMN_ROLE)[keyof typeof COLUMN_ROLE];

export interface DetectedColumn {
	index: number;
	role: ColumnRole;
	/** The header cell text for this column, or `null` when no header was found. */
	headerLabel: string | null;
}

export interface ColumnDetectionResult {
	/** Index into the input rows of the detected header, or `null` when headerless. */
	headerRowIndex: number | null;
	/** First data row index (inclusive). */
	dataStartIndex: number;
	/** End of data rows (exclusive). */
	dataEndIndex: number;
	skippedPreambleRows: number;
	skippedFooterRows: number;
	columns: DetectedColumn[];
}

/** How many leading rows to scan when looking for a header. */
const HEADER_SCAN_LIMIT = 10;
/** A column's values must hit this fraction (of non-empty cells) to claim a role. */
const ROLE_VALUE_THRESHOLD = 0.6;

const HEADER_KEYWORDS = {
	url: ['link', 'odkaz', 'url', 'web', 'adresa', 'stranka', 'http'],
	price: ['price', 'cena', 'cost', 'castka', 'kc', 'czk', 'eur', 'usd'],
	bool: [
		'vybrano',
		'taken',
		'status',
		'stav',
		'hotovo',
		'koupeno',
		'reserved',
		'rezervovano',
		'mame',
		'done',
		'checked',
	],
	name: [
		'name',
		'nazev',
		'darek',
		'gift',
		'present',
		'item',
		'polozka',
		'produkt',
		'prani',
		'predmet',
	],
	notes: [
		'note',
		'poznamka',
		'popis',
		'description',
		'desc',
		'type',
		'typ',
		'detail',
		'komentar',
	],
} as const;

/** Header keyword groups are tried in this order; first match wins. */
const HEADER_ROLE_ORDER = ['url', 'price', 'bool', 'name', 'notes'] as const;

const BOOL_TOKENS = new Set([
	'true',
	'false',
	'ano',
	'ne',
	'yes',
	'no',
	'y',
	'n',
	'x',
	'1',
	'0',
	'✓',
	'✔',
]);

const PRICE_CURRENCY_RE = /(kč|czk|eur|usd|kc|,-)/gi;

/** Lowercase + strip diacritics, for tolerant header matching. */
function normalize(text: string): string {
	return text
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.trim();
}

function containsUrl(cell: string): boolean {
	const trimmed = cell.trim();
	return /https?:\/\//i.test(trimmed) || /^www\./i.test(trimmed);
}

function looksLikeBool(cell: string): boolean {
	return BOOL_TOKENS.has(normalize(cell));
}

function looksLikePrice(cell: string): boolean {
	const stripped = cell
		.replace(PRICE_CURRENCY_RE, '')
		.replace(/[€$]/g, '')
		.replace(/[\s.,]/g, '')
		.trim();
	return stripped.length > 0 && /^\d+$/.test(stripped);
}

/** The most common cell count across rows; ties resolve to the larger width. */
function determineTableWidth(rows: readonly string[][]): number {
	const counts = new Map<number, number>();
	for (const row of rows) {
		counts.set(row.length, (counts.get(row.length) ?? 0) + 1);
	}
	let bestWidth = 0;
	let bestCount = -1;
	for (const [width, count] of counts) {
		if (count > bestCount || (count === bestCount && width > bestWidth)) {
			bestWidth = width;
			bestCount = count;
		}
	}
	return bestWidth;
}

/** A header row is a full-width row of non-empty label cells (no urls/prices/bools). */
function isHeaderCandidate(row: readonly string[], tableWidth: number): boolean {
	if (row.length !== tableWidth) {
		return false;
	}
	return row.every(
		(cell) =>
			cell.trim() !== '' &&
			!containsUrl(cell) &&
			!looksLikePrice(cell) &&
			!looksLikeBool(cell),
	);
}

function findHeaderRowIndex(rows: readonly string[][], tableWidth: number): number | null {
	const limit = Math.min(rows.length, HEADER_SCAN_LIMIT);
	for (let i = 0; i < limit; i++) {
		if (!isHeaderCandidate(rows[i], tableWidth)) {
			continue;
		}
		// Require at least one full-width data row after the candidate.
		for (let j = i + 1; j < rows.length; j++) {
			if (rows[j].length === tableWidth) {
				return i;
			}
		}
	}
	return null;
}

function matchHeaderRole(headerLabel: string): ColumnRole | null {
	const norm = normalize(headerLabel);
	for (const role of HEADER_ROLE_ORDER) {
		if (HEADER_KEYWORDS[role].some((keyword) => norm.includes(keyword))) {
			return role;
		}
	}
	return null;
}

function classifyByValues(cells: readonly string[]): ColumnRole | 'unknown' {
	const nonEmpty = cells.filter((cell) => cell.trim() !== '');
	if (nonEmpty.length === 0) {
		return 'unknown';
	}
	const fraction = (predicate: (cell: string) => boolean): number =>
		nonEmpty.filter(predicate).length / nonEmpty.length;

	if (fraction(containsUrl) >= ROLE_VALUE_THRESHOLD) {
		return COLUMN_ROLE.url;
	}
	if (fraction(looksLikeBool) >= ROLE_VALUE_THRESHOLD) {
		return COLUMN_ROLE.bool;
	}
	if (fraction(looksLikePrice) >= ROLE_VALUE_THRESHOLD) {
		return COLUMN_ROLE.price;
	}
	return 'unknown';
}

function columnCells(rows: readonly string[][], columnIndex: number): string[] {
	return rows.map((row) => row[columnIndex] ?? '');
}

/** Whether a trailing row is a stray note: no url/price/bool value and <2 cells filled. */
function isFooterNoteRow(row: readonly string[], structuralColumns: ReadonlySet<number>): boolean {
	let filled = 0;
	for (let i = 0; i < row.length; i++) {
		const value = (row[i] ?? '').trim();
		if (value === '') {
			continue;
		}
		filled++;
		if (structuralColumns.has(i)) {
			return false;
		}
	}
	return filled < 2;
}

export function detectColumns(rows: readonly string[][]): ColumnDetectionResult {
	if (rows.length === 0) {
		return {
			headerRowIndex: null,
			dataStartIndex: 0,
			dataEndIndex: 0,
			skippedPreambleRows: 0,
			skippedFooterRows: 0,
			columns: [],
		};
	}

	const tableWidth = determineTableWidth(rows);
	const headerRowIndex = findHeaderRowIndex(rows, tableWidth);

	let dataStartIndex: number;
	if (headerRowIndex !== null) {
		dataStartIndex = headerRowIndex + 1;
	} else {
		const firstFull = rows.findIndex((row) => row.length === tableWidth);
		dataStartIndex = firstFull === -1 ? 0 : firstFull;
	}

	const headerRow = headerRowIndex !== null ? rows[headerRowIndex] : null;
	const dataRows = rows.slice(dataStartIndex);

	// Per-column role: header keyword (authoritative) → value heuristics → unknown.
	const roles: (ColumnRole | 'unknown')[] = [];
	for (let col = 0; col < tableWidth; col++) {
		const headerLabel = headerRow?.[col] ?? null;
		const headerRole = headerLabel !== null ? matchHeaderRole(headerLabel) : null;
		roles.push(headerRole ?? classifyByValues(columnCells(dataRows, col)));
	}

	// Trim trailing footer/note rows using the structural (url/price/bool) columns.
	const structuralColumns = new Set<number>();
	roles.forEach((role, index) => {
		if (role === COLUMN_ROLE.url || role === COLUMN_ROLE.price || role === COLUMN_ROLE.bool) {
			structuralColumns.add(index);
		}
	});
	let dataEndIndex = rows.length;
	while (
		dataEndIndex > dataStartIndex &&
		isFooterNoteRow(rows[dataEndIndex - 1], structuralColumns)
	) {
		dataEndIndex--;
	}

	// Resolve remaining unknown text columns: first becomes name, rest notes.
	let hasName = roles.includes(COLUMN_ROLE.name);
	const columns: DetectedColumn[] = roles.map((role, index) => {
		let resolved: ColumnRole;
		if (role === 'unknown') {
			if (!hasName) {
				resolved = COLUMN_ROLE.name;
				hasName = true;
			} else {
				resolved = COLUMN_ROLE.notes;
			}
		} else {
			resolved = role;
		}
		return { index, role: resolved, headerLabel: headerRow?.[index] ?? null };
	});

	return {
		headerRowIndex,
		dataStartIndex,
		dataEndIndex,
		// Rows above the data start that aren't the header (the preamble itself).
		skippedPreambleRows: headerRowIndex ?? dataStartIndex,
		skippedFooterRows: rows.length - dataEndIndex,
		columns,
	};
}
