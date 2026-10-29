import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { CreateAccessTokenInputSchema, RollAccessTokenInputSchema } from './types.js';

const validInput = { name: 'Claude', scopes: [], wishlistIds: null };

function parses(input: Record<string, unknown>): boolean {
	return v.safeParse(CreateAccessTokenInputSchema, { ...validInput, ...input }).success;
}

describe('access token creation input', () => {
	it('expires after 365 days unless told otherwise', () => {
		expect(v.parse(CreateAccessTokenInputSchema, validInput).expiryDays).toBe(365);
	});

	it('offers the 30, 90, 365, 1825 and 3650 day presets only', () => {
		for (const days of [30, 90, 365, 1825, 3650]) {
			expect(parses({ expiryDays: days }), String(days)).toBe(true);
		}
		for (const days of [0, 1, 7, 60, 366, 3651]) {
			expect(parses({ expiryDays: days }), String(days)).toBe(false);
		}
	});

	it('never creates a non-expiring token or one expiring on a custom date', () => {
		expect(parses({ expiryDays: null })).toBe(false);
		expect(parses({ expiryDays: '365' })).toBe(false);
		expect(parses({ expiry: { kind: 'custom', expiresAt: new Date('2027-01-01') } })).toBe(
			false,
		);
		expect(parses({ expiresAt: new Date('2027-01-01') })).toBe(false);
	});

	it('takes a trimmed name of 1 to 60 characters', () => {
		expect(
			v.parse(CreateAccessTokenInputSchema, { ...validInput, name: '  Claude  ' }).name,
		).toBe('Claude');
		expect(parses({ name: '   ' })).toBe(false);
		expect(parses({ name: 'a'.repeat(60) })).toBe(true);
		expect(parses({ name: 'a'.repeat(61) })).toBe(false);
	});

	it('accepts only known scopes and a non-empty wishlist restriction', () => {
		expect(parses({ scopes: ['gifts:write', 'reservations:identities'] })).toBe(true);
		expect(parses({ scopes: ['admin'] })).toBe(false);
		expect(parses({ wishlistIds: ['wishlist-1'] })).toBe(true);
		expect(parses({ wishlistIds: [] })).toBe(false);
	});

	it('keeps fast-forward off by default', () => {
		expect(v.parse(CreateAccessTokenInputSchema, validInput).fastForward).toBe(false);
	});
});

describe('access token roll input', () => {
	it('keeps the current lifetime unless a new expiry is chosen', () => {
		expect(
			v.parse(RollAccessTokenInputSchema, { tokenId: 'token-1' }).expiryDays,
		).toBeUndefined();
	});

	it('takes the same presets as creation, never non-expiring or a custom date', () => {
		const roll = (input: Record<string, unknown>) =>
			v.safeParse(RollAccessTokenInputSchema, { tokenId: 'token-1', ...input }).success;
		for (const days of [30, 90, 365, 1825, 3650]) {
			expect(roll({ expiryDays: days }), String(days)).toBe(true);
		}
		expect(roll({ expiryDays: 7 })).toBe(false);
		expect(roll({ expiryDays: null })).toBe(false);
		expect(
			roll({ expiry: { kind: 'custom', expiresAt: new Date('2027-01-01T00:00:00Z') } }),
		).toBe(false);
	});
});
