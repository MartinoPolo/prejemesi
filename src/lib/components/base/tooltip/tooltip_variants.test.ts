import { describe, expect, it } from 'vitest';
import { tooltipContentVariants, tooltipPositionerClass } from './tooltip_variants.js';

describe('tooltip arrow shadow geometry', () => {
	it('casts the sticker shadow from the bubble and arrow union', () => {
		expect(tooltipPositionerClass).toContain('drop-shadow-[2px_2px_0_var(--hard-shadow)]');
		expect(tooltipContentVariants()).not.toContain('shadow-sticker-sm');
	});
});
