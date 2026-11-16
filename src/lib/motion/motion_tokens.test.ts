import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DURATION_FAST_MS, DURATION_NORMAL_MS, STANDARD_EASING } from './motion_tokens.js';

const css = readFileSync(new URL('../../app.css', import.meta.url), 'utf8');

function rootToken(name: string): string {
	const declaration = new RegExp(`^\\s*--${name}:\\s*([^;]+);`, 'm').exec(css);
	expect(declaration, `missing --${name} in app.css`).not.toBeNull();
	return declaration![1]!.trim();
}

describe('motion tokens', () => {
	it('mirror the app.css motion tokens', () => {
		expect(STANDARD_EASING).toBe(rootToken('ease-standard'));
		expect(`${DURATION_FAST_MS}ms`).toBe(rootToken('duration-fast'));
		expect(`${DURATION_NORMAL_MS}ms`).toBe(rootToken('duration-normal'));
	});
});
