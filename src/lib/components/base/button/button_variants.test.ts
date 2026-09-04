import { describe, expect, it } from 'vitest';
import { giftDetailModalVariants } from '$lib/components/blocks/gift/gift_detail_modal_variants.js';
import { overlayCloseButtonClass } from '$lib/components/base/dialog/dialog_close_button.js';
import { cn } from '$lib/utils.js';
import {
	ANCHORED_CIRCULAR_STICKER_BUTTON_CLASSES,
	BUTTON_TEXT_SIZES,
	CIRCULAR_STICKER_BUTTON_CLASSES,
	buttonVariants,
} from './button_variants.js';

describe('sticker button hover geometry', () => {
	it('assigns every raised intent to the shared interaction contract and hit area', () => {
		for (const intent of [
			'primary',
			'secondary',
			'danger',
			'primary-destructive',
			'outline',
		] as const) {
			const classes = buttonVariants({ intent });

			expect(classes).toContain('elevation-interactive');
			expect(classes).toContain('elevation-anchored-trigger');
			expect(classes).toContain('after:h-2');
			expect(classes).not.toContain('shadow-sticker-sm');
		}
	});

	it('distinguishes free circular controls from anchored overlay triggers', () => {
		expect(CIRCULAR_STICKER_BUTTON_CLASSES).toContain('elevation-interactive');
		expect(CIRCULAR_STICKER_BUTTON_CLASSES).not.toContain('elevation-anchored-trigger');
		expect(ANCHORED_CIRCULAR_STICKER_BUTTON_CLASSES).toContain('elevation-anchored-trigger');
	});

	it('keeps the stacked gift-editor footer buttons lift-free', () => {
		const styles = giftDetailModalVariants();

		expect(styles.submitButton()).toContain('hover:translate-y-0');
		expect(styles.releaseButton()).toContain('hover:translate-y-0');
	});

	it('keeps overlay close surfaces anchored at the logical top-right', () => {
		const composedClasses = cn(
			buttonVariants({ intent: 'ghost', size: 'icon-sm' }),
			overlayCloseButtonClass,
		);
		const positioningClasses = composedClasses
			.split(/\s+/)
			.filter((className) => ['relative', 'absolute', 'fixed', 'sticky'].includes(className));

		expect(positioningClasses).toEqual(['absolute']);
	});
});

describe('shared control-height scale', () => {
	it('provides the 48px xl hero/action step', () => {
		expect(BUTTON_TEXT_SIZES).toEqual(['sm', 'md', 'lg', 'xl']);
		expect(buttonVariants({ size: 'xl' })).toContain('h-(--size-control-xl)');
	});
});

describe('gift editor paired-row geometry', () => {
	it('gives every two-column field a shared label row before md controls', () => {
		const styles = giftDetailModalVariants();

		expect(styles.formRow()).toContain('grid-cols-2');
		expect(styles.formLabelRow()).toContain('min-h-6');
		expect(styles.formLabelRow()).toContain('items-center');
	});
});
