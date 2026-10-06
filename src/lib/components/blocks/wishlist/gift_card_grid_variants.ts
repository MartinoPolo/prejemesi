import { tv } from 'tailwind-variants';

/**
 * Card grid gap and the chosen column template. A chosen count N renders N columns when each card
 * keeps `--gift-card-minimum-width`; otherwise auto-fill drops to the largest count that does.
 * The 0.1px slack stops sub-pixel rounding from losing a column at an exactly fitting width.
 * Below `sm` the mobile controls are larger, so the responsive Automatic template stays in charge.
 */
export const giftCardGridVariants = tv({
	base: '[--gift-card-grid-gap:--spacing(2)] gap-(--gift-card-grid-gap) sm:[--gift-card-grid-gap:--spacing(5)]',
	variants: {
		columns: {
			automatic: '',
			four: '[--gift-card-column-count:4]',
			five: '[--gift-card-column-count:5]',
		},
	},
	compoundVariants: [
		{
			columns: ['four', 'five'],
			class: 'sm:[grid-template-columns:repeat(auto-fill,minmax(max(min(100%,var(--gift-card-minimum-width)),calc((100%_-_(var(--gift-card-column-count)_-_1)_*_var(--gift-card-grid-gap))_/_var(--gift-card-column-count)_-_0.1px)),1fr))]',
		},
	],
	defaultVariants: {
		columns: 'automatic',
	},
});
