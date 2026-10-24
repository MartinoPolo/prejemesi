import type { ButtonSize } from '$lib/components/base/button/button_variants.js';

/**
 * Per-size Přehled shelf geometry. Every card slide within a row keeps one width so the next card
 * always peeks by the same amount; the trailing „Zobrazit vše" slide is intentionally narrower.
 */
export const HOME_SHELF_SIZES = {
	/** The prominent „Nedávné" row. */
	large: {
		slideClass: 'basis-[min(300px,78vw)] sm:basis-[388px]',
		trailingSlideClass: 'basis-[200px]',
		arrowSize: 'md',
	},
	/** The category rows. */
	compact: {
		slideClass: 'basis-[min(216px,56vw)] sm:basis-[256px]',
		trailingSlideClass: 'basis-[168px]',
		arrowSize: 'sm',
	},
} as const satisfies Record<
	string,
	{ slideClass: string; trailingSlideClass: string; arrowSize: ButtonSize }
>;

export type HomeShelfSize = keyof typeof HOME_SHELF_SIZES;
