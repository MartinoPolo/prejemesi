import { describe, expect, it } from 'vitest';
import { giftDetailModalVariants } from '$lib/components/blocks/gift/gift_detail_modal_variants.js';
import { buttonVariants } from './button_variants.js';

describe('sticker button hover geometry', () => {
	it('keeps lifted inline stickers within an eight-pixel bottom hit area', () => {
		for (const intent of ['primary', 'secondary', 'primary-destructive', 'outline'] as const) {
			const classes = buttonVariants({ intent });

			expect(classes).toContain('hover:-translate-y-0.5');
			expect(classes).toContain('after:h-2');
		}
	});

	it('keeps the stacked gift-editor footer buttons lift-free', () => {
		const styles = giftDetailModalVariants();

		expect(styles.submitButton()).toContain('hover:translate-y-0');
		expect(styles.receivedButton()).toContain('hover:translate-y-0');
	});
});
