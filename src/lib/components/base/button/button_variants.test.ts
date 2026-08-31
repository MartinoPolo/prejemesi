import { describe, expect, it } from 'vitest';
import { giftDetailModalVariants } from '$lib/components/blocks/gift/gift_detail_modal_variants.js';
import { overlayCloseButtonClass } from '$lib/components/base/dialog/dialog_close_button.js';
import {
	BUTTON_TEXT_SIZES,
	CIRCULAR_STICKER_BUTTON_CLASSES,
	buttonVariants,
} from './button_variants.js';

describe('sticker button hover geometry', () => {
	it('keeps lifted inline stickers within an eight-pixel bottom hit area', () => {
		for (const intent of ['primary', 'secondary', 'primary-destructive', 'outline'] as const) {
			const classes = buttonVariants({ intent });

			expect(classes).toContain('hover:-translate-y-0.5');
			expect(classes).toContain('after:h-2');
		}
	});

	it('keeps an open overlay trigger flat so hover cannot shift the anchored dropdown', () => {
		for (const intent of ['primary', 'secondary', 'primary-destructive', 'outline'] as const) {
			const classNames = buttonVariants({ intent }).split(/\s+/);

			expect(classNames).toContain('data-[state=open]:hover:translate-y-0');
			expect(classNames).toContain('data-[state=open]:hover:shadow-sticker');
		}
	});

	it('keeps the stacked gift-editor footer buttons lift-free', () => {
		const styles = giftDetailModalVariants();

		expect(styles.submitButton()).toContain('hover:translate-y-0');
		expect(styles.releaseButton()).toContain('hover:translate-y-0');
	});

	it('shares resting and hover elevation for circular sticker controls', () => {
		expect(CIRCULAR_STICKER_BUTTON_CLASSES).toContain('shadow-sticker-sm');
		expect(CIRCULAR_STICKER_BUTTON_CLASSES).toContain('hover:-translate-y-0.5');
		expect(CIRCULAR_STICKER_BUTTON_CLASSES).toContain('hover:shadow-sticker-lift');
		expect(CIRCULAR_STICKER_BUTTON_CLASSES).toContain('after:h-2');
		expect(CIRCULAR_STICKER_BUTTON_CLASSES).toContain('motion-reduce:hover:translate-y-0');
	});

	it('keeps open circular triggers anchored while preserving shadow feedback', () => {
		expect(CIRCULAR_STICKER_BUTTON_CLASSES).toContain('data-[state=open]:hover:translate-y-0');
		expect(CIRCULAR_STICKER_BUTTON_CLASSES).toContain(
			'data-[state=open]:hover:shadow-sticker-lift',
		);
	});

	it('rotates only the close icon and suppresses that motion when requested', () => {
		const classNames = overlayCloseButtonClass.split(/\s+/);

		expect(classNames).not.toContain('hover:rotate-90');
		expect(classNames).toContain('hover:[&_svg]:rotate-90');
		expect(classNames).toContain('motion-reduce:hover:[&_svg]:rotate-0');
		expect(classNames).toContain('motion-reduce:[&_svg]:transition-none');
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
