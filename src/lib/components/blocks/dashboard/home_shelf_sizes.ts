import type { ButtonSize } from '$lib/components/base/button/button_variants.js';

/**
 * Per-size Přehled shelf geometry. Card slides size from the row's width in bands, so whole cards
 * plus a fractional peek of the next one fill the row at every width; the trailing „Zobrazit vše"
 * slide keeps a fixed, narrower width.
 */
export const HOME_SHELF_SIZES = {
	/** The prominent „Nedávné" row. */
	large: {
		slideClass:
			'basis-[calc(100cqw/1.2)] @min-[520px]:basis-[calc(100cqw/1.6)] @min-[720px]:basis-[calc(100cqw/2.3)] @min-[1000px]:basis-[calc(100cqw/3.1)]',
		trailingSlideClass: 'basis-[200px]',
		arrowSize: 'md',
	},
	/** The category rows. */
	compact: {
		slideClass:
			'basis-[calc(100cqw/1.7)] @min-[440px]:basis-[calc(100cqw/2.4)] @min-[640px]:basis-[calc(100cqw/3.3)] @min-[880px]:basis-[calc(100cqw/4.3)] @min-[1120px]:basis-[calc(100cqw/4.6)]',
		trailingSlideClass: 'basis-[168px]',
		arrowSize: 'sm',
	},
} as const satisfies Record<
	string,
	{ slideClass: string; trailingSlideClass: string; arrowSize: ButtonSize }
>;

export type HomeShelfSize = keyof typeof HOME_SHELF_SIZES;
