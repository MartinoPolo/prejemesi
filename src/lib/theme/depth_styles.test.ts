import { describe, expect, it } from 'vitest';
import { DEPTH_STYLES, isDepthStyle } from './depth_styles.js';

describe('viewer depth style domain', () => {
	it('accepts exactly soft, ink, and black', () => {
		expect(DEPTH_STYLES).toEqual(['soft', 'ink', 'black']);
		expect(DEPTH_STYLES.every(isDepthStyle)).toBe(true);
		expect(['', 'hard', 'Soft', null, 1].some(isDepthStyle)).toBe(false);
	});
});
