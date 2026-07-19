import { describe, expect, it } from 'vitest';
import { INPUT_SIZES, inputVariants } from './input_variants.js';

describe('Input shared control-height scale', () => {
	it('offers semantic md and lg sizes', () => {
		expect(INPUT_SIZES).toEqual(['md', 'lg']);
		expect(inputVariants({ size: 'md' })).toContain('h-(--size-control-md)');
		expect(inputVariants({ size: 'lg' })).toContain('h-(--size-control-lg)');
	});

	it('keeps validation state orthogonal to size', () => {
		const classes = inputVariants({ size: 'lg', state: 'error' });

		expect(classes).toContain('h-(--size-control-lg)');
		expect(classes).toContain('border-status-danger');
	});
});
