import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseTabular } from './parse_tabular.js';

function fixture(name: string): string {
	return readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf-8');
}

describe('parseTabular – sample CSV fixtures', () => {
	it('parses the clean 4-column file (preamble + trailing empty row present)', () => {
		const { rows, delimiter } = parseTabular(fixture('darky_rosie_clean.csv'));
		expect(delimiter).toBe(',');
		// 2 preamble rows + header + 3 data rows = 6; trailing empty row dropped.
		expect(rows).toHaveLength(6);
		expect(rows[2]).toEqual(['Name', 'Type/notes', 'Link', 'Vybráno']);
		// Quoted comma stays a single cell.
		expect(rows[4]).toEqual([
			'Kniha',
			'Sci-fi, brožovaná',
			'https://www.kosmas.cz/kniha',
			'TRUE',
		]);
	});

	it('parses the dirty file without crashing on non-URL, missing, and double-pasted links', () => {
		const { rows } = parseTabular(fixture('maggie_dirty.csv'));
		// header + 4 data rows + 1 footer note row = 6.
		expect(rows).toHaveLength(6);
		// Missing link → empty cell, not a dropped column.
		expect(rows[2]).toEqual(['Boty', 'Kožené, hnědé', '', 'FALSE']);
		// Double-pasted URL is preserved verbatim (flagged later, not dropped here).
		expect(rows[3][2]).toBe(
			'https://www.notino.cz/parfem-388400https://www.notino.cz/parfem-388400',
		);
		// Embedded newline inside a quoted field stays one cell.
		expect(rows[4][1]).toBe('Hedvábná\ns třásněmi');
	});

	it('parses the messy 2-column file (section headers + link-only rows) without crashing', () => {
		const { rows } = parseTabular(fixture('rosie_vse_messy.csv'));
		expect(rows).toHaveLength(8);
		// Link-only row: empty name cell preserved.
		expect(rows[2]).toEqual(['', 'https://www.alza.cz/kostka-jina-barva']);
		// Section header is a single-cell row.
		expect(rows[5]).toEqual(['Knížky']);
	});
});

describe('parseTabular – edge cases', () => {
	it('strips a leading UTF-8 BOM', () => {
		const { rows } = parseTabular('﻿Name,Link\nBoty,https://example.com');
		expect(rows[0]).toEqual(['Name', 'Link']);
	});

	it('auto-detects a tab delimiter (pasted spreadsheet range)', () => {
		const { rows, delimiter } = parseTabular('Name\tLink\nBoty\thttps://example.com');
		expect(delimiter).toBe('\t');
		expect(rows[1]).toEqual(['Boty', 'https://example.com']);
	});

	it('auto-detects a semicolon delimiter', () => {
		const { delimiter } = parseTabular('Name;Link;Cena\nBoty;https://example.com;1299');
		expect(delimiter).toBe(';');
	});

	it('keeps an embedded comma inside a quoted field as one cell', () => {
		const { rows } = parseTabular('Name,Notes\nKniha,"Sci-fi, brožovaná"');
		expect(rows[1]).toEqual(['Kniha', 'Sci-fi, brožovaná']);
	});

	it('drops fully-empty rows but keeps rows with at least one value', () => {
		const { rows } = parseTabular('A,B\n\n , \nX,');
		expect(rows).toEqual([
			['A', 'B'],
			['X', ''],
		]);
	});

	it('returns no rows for empty input', () => {
		expect(parseTabular('').rows).toEqual([]);
	});

	it('accepts an explicit { kind: "text" } wrapper', () => {
		const { rows } = parseTabular({
			kind: 'text',
			text: 'Name,Link\nBoty,https://example.com',
		});
		expect(rows).toEqual([
			['Name', 'Link'],
			['Boty', 'https://example.com'],
		]);
	});
});

describe('parseTabular – HTML clipboard table', () => {
	it('extracts cells from an HTML table fragment', () => {
		const html =
			'<table><tr><td>Name</td><td>Link</td></tr><tr><td>Boty</td><td>https://example.com</td></tr></table>';
		const { rows } = parseTabular({ kind: 'html', html });
		expect(rows).toEqual([
			['Name', 'Link'],
			['Boty', 'https://example.com'],
		]);
	});

	it('falls back to a hyperlink href when the cell text is empty', () => {
		const html =
			'<table><tr><td>Boty</td><td><a href="https://shop.example/boty"></a></td></tr></table>';
		const { rows } = parseTabular({ kind: 'html', html });
		expect(rows[0]).toEqual(['Boty', 'https://shop.example/boty']);
	});

	it('decodes named, numeric, and hex HTML entities in cell text', () => {
		const html =
			'<table><tr><td>Kniha &amp; pero</td><td>cena&#32;100</td><td>&#x41;&#x42;</td></tr></table>';
		const { rows } = parseTabular({ kind: 'html', html });
		expect(rows[0]).toEqual(['Kniha & pero', 'cena 100', 'AB']);
	});

	it('keeps a cell empty when it has neither text nor a hyperlink', () => {
		const html = '<table><tr><td>Boty</td><td></td></tr></table>';
		const { rows } = parseTabular({ kind: 'html', html });
		expect(rows[0]).toEqual(['Boty', '']);
	});

	it('returns no rows when the HTML has no table', () => {
		expect(parseTabular({ kind: 'html', html: '<div>nope</div>' }).rows).toEqual([]);
	});
});
