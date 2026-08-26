import { describe, expect, it } from 'vitest';
import { cn } from '$lib/utils.js';
import { tooltipContentVariants } from './tooltip_variants.js';

describe('tooltip content variants', () => {
	it('allows callers to override visual sizing and color classes', () => {
		const classes = cn(tooltipContentVariants(), 'max-w-none bg-primary px-5 text-sm').split(
			' ',
		);

		expect(classes).toEqual(
			expect.arrayContaining(['max-w-none', 'bg-primary', 'px-5', 'text-sm']),
		);
		expect(classes).not.toContain('max-w-xs');
		expect(classes).not.toContain('bg-card');
		expect(classes).not.toContain('px-3');
		expect(classes).not.toContain('text-[11px]');
	});
});
