import { describe, expect, it } from 'vitest';
import { cn } from '$lib/utils.js';
import { DIALOG_CONTENT_SIZES, dialogContentVariants } from './dialog_variants.js';

describe('dialog content size scale', () => {
	it('emits the expected sm: breakpoint max-width for every size', () => {
		const expectedClassBySize = {
			sm: 'sm:max-w-sm',
			md: 'sm:max-w-md',
			lg: 'sm:max-w-lg',
			xl: 'sm:max-w-xl',
			'2xl': 'sm:max-w-2xl',
		} as const satisfies Record<(typeof DIALOG_CONTENT_SIZES)[number], string>;

		for (const size of DIALOG_CONTENT_SIZES) {
			expect(dialogContentVariants({ size })).toContain(expectedClassBySize[size]);
		}
	});

	it('defaults to lg to preserve pre-existing call sites that pass no size', () => {
		expect(dialogContentVariants({})).toContain('sm:max-w-lg');
	});

	it('keeps the mobile max-width cap in the base class regardless of size', () => {
		for (const size of DIALOG_CONTENT_SIZES) {
			expect(dialogContentVariants({ size })).toContain('max-w-[calc(100%-2rem)]');
		}
	});

	it('lets a caller-supplied sm: max-w class win over the default sm:max-w-lg (regression)', () => {
		const classes = cn(dialogContentVariants({}), 'sm:max-w-[35rem]');
		const smMaxWidthClasses = classes
			.split(/\s+/)
			.filter((className) => className.startsWith('sm:max-w-'));

		expect(smMaxWidthClasses).toEqual(['sm:max-w-[35rem]']);
	});
});
