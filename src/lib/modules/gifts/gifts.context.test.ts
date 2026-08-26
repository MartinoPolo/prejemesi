import { describe, expect, it } from 'vitest';
import { shouldApplyLikedOnly } from './gifts.context.svelte.js';

describe('liked-only presentation filtering', () => {
	it('ignores the active preference for recipients and resumes it when the role is restored', () => {
		const likedOnly = true;

		expect(shouldApplyLikedOnly(likedOnly, 'visitor')).toBe(true);
		expect(shouldApplyLikedOnly(likedOnly, 'recipient')).toBe(false);
		expect(shouldApplyLikedOnly(likedOnly, 'moderator')).toBe(true);
		expect(shouldApplyLikedOnly(likedOnly, 'visitor')).toBe(true);
	});
});
