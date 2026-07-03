import Papa from 'papaparse';

/**
 * A parsed table: a rectangular-ish grid of trimmed string cells plus the
 * delimiter that was used. Rows that are entirely empty are dropped; cell text
 * is preserved verbatim (RFC-4180 quoting, embedded commas/newlines, BOM strip
 * are all handled by the parser). Header detection and preamble/footer skipping
 * are NOT done here – see {@link detectColumns}.
 */
export interface ParsedTable {
	rows: string[][];
	/** The delimiter PapaParse detected/used (e.g. `,` or `\t`). */
	delimiter: string;
}

/** Input to {@link parseTabular}: raw delimited text, or an HTML clipboard table. */
export type TabularInput = string | { kind: 'text'; text: string } | { kind: 'html'; html: string };

/** Strip a leading UTF-8 BOM if present. */
function stripBom(text: string): string {
	return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** True when a row has no non-empty cells. */
function isEmptyRow(row: readonly string[]): boolean {
	return row.every((cell) => cell.trim() === '');
}

/**
 * Parse delimited text via PapaParse. Delimiter is auto-detected (comma vs tab
 * vs semicolon) unless one is supplied. Quoted fields, embedded commas/newlines
 * and a leading BOM are all handled. Fully-empty rows are removed.
 */
function parseDelimitedText(text: string, delimiter?: string): ParsedTable {
	const result = Papa.parse<string[]>(stripBom(text), {
		delimiter: delimiter ?? '',
		skipEmptyLines: 'greedy',
		// Keep everything as raw strings; we classify columns ourselves.
		header: false,
		dynamicTyping: false,
	});

	// `dynamicTyping: false` guarantees every cell is a string.
	const rows = result.data
		.map((row) => row.map((cell) => cell.trim()))
		.filter((row) => !isEmptyRow(row));

	const resolvedDelimiter =
		result.meta.delimiter !== '' ? result.meta.delimiter : (delimiter ?? ',');
	return { rows, delimiter: resolvedDelimiter };
}

const TABLE_RE = /<table[\s\S]*?<\/table>/i;
const ROW_RE = /<tr[\s\S]*?<\/tr>/gi;
const CELL_RE = /<(td|th)\b[\s\S]*?<\/\1>/gi;
const ANCHOR_HREF_RE = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/i;

const HTML_ENTITIES: Record<string, string> = {
	'&amp;': '&',
	'&lt;': '<',
	'&gt;': '>',
	'&quot;': '"',
	'&#39;': "'",
	'&apos;': "'",
	'&nbsp;': ' ',
};

function decodeHtmlEntities(text: string): string {
	return text
		.replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
		.replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
		.replace(/&[a-z]+;|&#39;/gi, (entity) => HTML_ENTITIES[entity.toLowerCase()] ?? entity);
}

/** Extract the visible text of an HTML fragment (tags stripped, entities decoded). */
function htmlCellText(cellHtml: string): string {
	const text = cellHtml
		.replace(/<(td|th)\b[^>]*>/i, '')
		.replace(/<\/(td|th)>/i, '')
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<[^>]+>/g, '');
	return decodeHtmlEntities(text).trim();
}

/**
 * Parse an HTML clipboard table (the `text/html` flavour Excel/Sheets place on
 * the clipboard). For each cell the visible text is used; when a cell has no
 * visible text but contains a hyperlink, the href is used so link-only cells
 * survive. Returns no rows when the fragment contains no `<table>`.
 */
function parseHtmlTable(html: string): ParsedTable {
	const tableMatch = TABLE_RE.exec(html);
	if (tableMatch === null) {
		return { rows: [], delimiter: '\t' };
	}

	const rows: string[][] = [];
	for (const rowMatch of tableMatch[0].matchAll(ROW_RE)) {
		const cells: string[] = [];
		for (const cellMatch of rowMatch[0].matchAll(CELL_RE)) {
			const cellHtml = cellMatch[0];
			let value = htmlCellText(cellHtml);
			if (value === '') {
				const hrefMatch = ANCHOR_HREF_RE.exec(cellHtml);
				if (hrefMatch !== null) {
					value = decodeHtmlEntities(hrefMatch[1]).trim();
				}
			}
			cells.push(value);
		}
		if (!isEmptyRow(cells) && cells.length > 0) {
			rows.push(cells);
		}
	}

	return { rows, delimiter: '\t' };
}

/**
 * Parse tabular input into a grid of string cells.
 *
 * Accepts a raw delimited-text string (CSV/TSV), an explicit `{ kind: 'text' }`
 * wrapper, or an `{ kind: 'html' }` clipboard table. Handles RFC-4180 quoting,
 * embedded commas/newlines, a leading BOM, and delimiter auto-detection.
 */
export function parseTabular(input: TabularInput): ParsedTable {
	if (typeof input === 'string') {
		return parseDelimitedText(input);
	}
	if (input.kind === 'html') {
		return parseHtmlTable(input.html);
	}
	return parseDelimitedText(input.text);
}
