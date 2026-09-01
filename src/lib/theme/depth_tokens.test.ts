import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../../app.css', import.meta.url), 'utf8');

function ruleBody(selector: string): string {
	const ruleStart = css.indexOf(`${selector} {`);
	expect(ruleStart, `missing complete selector: ${selector}`).toBeGreaterThanOrEqual(0);
	const bodyStart = css.indexOf('{', ruleStart) + 1;
	const bodyEnd = css.indexOf('}', bodyStart);
	expect(bodyEnd, `missing rule end: ${selector}`).toBeGreaterThan(bodyStart);
	return css.slice(bodyStart, bodyEnd).replaceAll(/\/\*[\s\S]*?\*\//g, '');
}

function expectDeclarations(rule: string, declarations: readonly string[]) {
	const actualDeclarations = rule
		.split(';')
		.map((declaration) => declaration.trim())
		.filter(Boolean);
	for (const declaration of declarations) {
		expect(actualDeclarations).toContain(declaration);
	}
}

describe('canonical semantic depth tokens', () => {
	it('defines every approved light recipe in the root and nested palette derivation rule', () => {
		const lightRule = ruleBody(':root,\n[data-palette]');
		expectDeclarations(lightRule, [
			'--soft-shadow: color-mix(in oklab, var(--p-ink) 16%, transparent)',
			'--soft-shadow-strong: color-mix(in oklab, var(--p-ink) 20%, transparent)',
			'--ink-shadow: color-mix(in oklab, var(--p-ink) 58%, transparent)',
			'--ink-shadow-strong: color-mix(in oklab, var(--p-ink) 68%, transparent)',
			'--black-shadow: #000',
			'--black-shadow-strong: #000',
		]);
	});

	it('defines every approved dark recipe in the root and nested palette derivation rule', () => {
		const darkRule = ruleBody('.dark,\n.dark [data-palette]');
		expectDeclarations(darkRule, [
			'--soft-shadow: rgb(2 6 12 / 42%)',
			'--soft-shadow-strong: rgb(2 6 12 / 55%)',
			'--ink-shadow: rgb(2 6 12 / 48%)',
			'--ink-shadow-strong: rgb(2 6 12 / 62%)',
			'--black-shadow: #000',
			'--black-shadow-strong: #000',
		]);
	});

	it.each([
		['soft', '--soft-shadow', '--soft-shadow-strong'],
		['ink', '--ink-shadow', '--ink-shadow-strong'],
		['black', '--black-shadow', '--black-shadow-strong'],
	])(
		'maps %s to shadow tokens without changing any boundary or geometry token',
		(depth, shadow, strong) => {
			const mappingRule = ruleBody(
				`[data-depth='${depth}'],\n[data-depth='${depth}'] [data-palette]`,
			);
			const declarations = mappingRule
				.split(';')
				.map((declaration) => declaration.trim())
				.filter(Boolean);
			expect(declarations).toEqual([
				`--hard-shadow: var(${shadow})`,
				`--hard-shadow-strong: var(${strong})`,
			]);
		},
	);

	it('keeps the exact zero-blur sticker geometry', () => {
		const themeRule = ruleBody('@theme inline');
		expectDeclarations(themeRule, [
			'--shadow-sticker-sm: 2px 2px 0 var(--hard-shadow)',
			'--shadow-sticker: 4px 4px 0 var(--hard-shadow)',
			'--shadow-sticker-lift: 7px 7px 0 var(--hard-shadow)',
		]);
	});
});
