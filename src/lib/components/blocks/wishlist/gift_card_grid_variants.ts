import { tv } from 'tailwind-variants';

/**
 * Card grid column template; `app.css` owns `--gift-card-grid-gap` because the page width chosen
 * for 4 or 5 columns depends on it. Automatic auto-fills 280px cards. From `sm`, a chosen
 * `--gift-card-column-count` N renders N columns when each card keeps `--gift-card-minimum-width`;
 * otherwise auto-fill drops to the largest count that does, the same rule as
 * `largestFittingGiftCardColumnCount`. The 0.1px slack only keeps sub-pixel rounding of the
 * N-column term from losing a column; the minimum width alone decides whether N fits.
 * Below `sm` the mobile controls are larger, so the Automatic template stays in charge.
 */
export const giftCardGridVariants = tv({
	base: '[grid-template-columns:repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-(--gift-card-grid-gap)',
	variants: {
		hasChosenColumnCount: {
			true: 'sm:[grid-template-columns:repeat(auto-fill,minmax(max(min(100%,var(--gift-card-minimum-width)),calc((100%_-_(var(--gift-card-column-count)_-_1)_*_var(--gift-card-grid-gap))_/_var(--gift-card-column-count)_-_0.1px)),1fr))]',
			false: '',
		},
	},
	defaultVariants: {
		hasChosenColumnCount: false,
	},
});
