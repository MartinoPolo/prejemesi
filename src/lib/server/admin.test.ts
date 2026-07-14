import { vi, describe, it, expect } from 'vitest';

// Fix the env for the isAppAdmin wiring test. The pure matcher (emailMatchesAdminList) is
// exercised directly for the parsing edge cases, so one env value is enough here.
vi.mock('$env/dynamic/private', () => ({
	env: { ADMIN_EMAILS: 'Martin@Test.cz, ops@example.com' },
}));

import { parseAdminEmails, emailMatchesAdminList, isAppAdmin } from './admin.js';

/**
 * App-admin resolution (issue #150). Expected truths derive from DECISIONS.md
 * §"App admin via ADMIN_EMAILS": a comma-separated list, matched case-insensitively
 * against the session email; empty/absent config grants no one.
 */
describe('parseAdminEmails', () => {
	it('splits, trims, lowercases and drops empty entries', () => {
		expect(parseAdminEmails('  A@b.cz , C@D.com ,,')).toEqual(['a@b.cz', 'c@d.com']);
	});

	it('returns an empty list for null / undefined / empty', () => {
		expect(parseAdminEmails(null)).toEqual([]);
		expect(parseAdminEmails(undefined)).toEqual([]);
		expect(parseAdminEmails('')).toEqual([]);
		expect(parseAdminEmails('   ')).toEqual([]);
	});
});

describe('emailMatchesAdminList', () => {
	const raw = 'martin@test.cz, ops@example.com';

	it('matches case-insensitively regardless of surrounding whitespace', () => {
		expect(emailMatchesAdminList('MARTIN@test.cz', raw)).toBe(true);
		expect(emailMatchesAdminList('  ops@example.com  ', raw)).toBe(true);
	});

	it('rejects a non-listed email', () => {
		expect(emailMatchesAdminList('eva@test.cz', raw)).toBe(false);
	});

	it('rejects blank / missing email or config', () => {
		expect(emailMatchesAdminList('', raw)).toBe(false);
		expect(emailMatchesAdminList(null, raw)).toBe(false);
		expect(emailMatchesAdminList(undefined, raw)).toBe(false);
		expect(emailMatchesAdminList('martin@test.cz', '')).toBe(false);
		expect(emailMatchesAdminList('martin@test.cz', null)).toBe(false);
	});
});

describe('isAppAdmin (reads ADMIN_EMAILS from env)', () => {
	it('matches a configured admin case-insensitively', () => {
		expect(isAppAdmin('martin@test.cz')).toBe(true);
		expect(isAppAdmin('OPS@example.com')).toBe(true);
	});

	it('rejects a non-admin and a missing email', () => {
		expect(isAppAdmin('eva@test.cz')).toBe(false);
		expect(isAppAdmin(null)).toBe(false);
		expect(isAppAdmin(undefined)).toBe(false);
	});
});
