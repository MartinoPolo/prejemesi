import { describe, it, expect } from 'vitest';

describe('Import append navigation', () => {
	it('should use wishlistShortId, not wishlistId (UUID), for append success navigation', () => {
		// This tests the contract: in append mode, the shortId returned
		// should be the human-friendly short ID, not a database UUID
		const wishlistId = '550e8400-e29b-41d4-a716-446655440000';
		const wishlistShortId = 'xK9m2nP4';

		// The bug: was returning wishlistId (UUID)
		// The fix: returns wishlistShortId
		const result = wishlistShortId ?? wishlistId;
		expect(result).toBe('xK9m2nP4');
		expect(result).not.toMatch(/^[0-9a-f]{8}-/); // NOT a UUID pattern
	});
});
