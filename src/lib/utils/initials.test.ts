import { describe, expect, it } from 'vitest';
import { getInitials } from './initials.js';

describe('getInitials', () => {
	it('returns the first letter of the first two words, uppercased', () => {
		expect(getInitials('Jana Dvořáková')).toBe('JD');
	});

	it('returns a single letter for a one-word name', () => {
		expect(getInitials('Martin')).toBe('M');
	});

	it('ignores extra words beyond the first two', () => {
		expect(getInitials('Anna Marie Nováková')).toBe('AM');
	});

	it('collapses repeated spaces without producing stray characters', () => {
		expect(getInitials('Jana  Dvořáková')).toBe('JD');
	});

	it('returns an empty string for an empty name', () => {
		expect(getInitials('')).toBe('');
	});
});
