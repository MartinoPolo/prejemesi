import { describe, expect, it } from 'vitest';
import { isReservedDemoEmail } from './constants.js';

describe('isReservedDemoEmail', () => {
	it.each([
		['a fullwidth demo address', 'ｄｅｍｏ＠ｄｅｍｏ．ｉｎｖａｌｉｄ'],
		['a demo address with a fullwidth at sign', 'demo-user＠demo.invalid'],
		['a padded mixed-case demo address', ' Demo-User@DEMO.invalid '],
	])('recognizes %s', (_description, email) => {
		expect(isReservedDemoEmail(email)).toBe(true);
	});

	it.each([
		['a normal address', 'martin@test.cz'],
		['undefined', undefined],
		['null', null],
		['a number', 42],
	])('rejects %s', (_description, value) => {
		expect(isReservedDemoEmail(value)).toBe(false);
	});
});
