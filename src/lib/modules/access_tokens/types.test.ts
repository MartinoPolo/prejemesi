import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { CreateAccessTokenInputSchema, RollAccessTokenInputSchema } from './types.js';

const validInput = { name: 'Claude', scopes: [], wishlistIds: null };

function parses(input: Record<string, unknown>): boolean {
	return v.safeParse(CreateAccessTokenInputSchema, { ...validInput, ...input }).success;
}

describe('access token creation input', () => {
	it('expires after 365 days unless told otherwise', () => {
		expect(v.parse(CreateAccessTokenInputSchema, validInput).expiry).toEqual({
			kind: 'preset',
			days: 365,
		});
	});

	it('offers the 30, 90, 365, 1825 and 3650 day presets only', () => {
		for (const days of [30, 90, 365, 1825, 3650]) {
			expect(parses({ expiry: { kind: 'preset', days } }), String(days)).toBe(true);
		}
		for (const days of [0, 1, 7, 60, 366, 3651]) {
			expect(parses({ expiry: { kind: 'preset', days } }), String(days)).toBe(false);
		}
	});

	it('never creates a non-expiring token', () => {
		expect(parses({ expiry: null })).toBe(false);
		expect(parses({ expiry: { kind: 'never' } })).toBe(false);
		expect(parses({ expiry: { kind: 'custom' } })).toBe(false);
		expect(parses({ expiry: { kind: 'custom', expiresAt: null } })).toBe(false);
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
		expect(v.parse(RollAccessTokenInputSchema, { tokenId: 'token-1' }).expiry).toBeUndefined();
	});

	it('takes the same expiry choices as creation, never non-expiring', () => {
		const roll = (expiry: unknown) =>
			v.safeParse(RollAccessTokenInputSchema, { tokenId: 'token-1', expiry }).success;
		for (const days of [30, 90, 365, 1825, 3650]) {
			expect(roll({ kind: 'preset', days }), String(days)).toBe(true);
		}
		expect(roll({ kind: 'custom', expiresAt: new Date('2027-01-01T00:00:00Z') })).toBe(true);
		expect(roll({ kind: 'preset', days: 7 })).toBe(false);
		expect(roll(null)).toBe(false);
		expect(roll({ kind: 'never' })).toBe(false);
	});
});
