import { tv } from 'tailwind-variants';

/**
 * Gift source links render as palette text links (issue #442): `chip` flows them inline for
 * cards and list rows; `row` stacks them in the gift detail with a touch-sized hit area and the
 * domain beside a custom label.
 */
export const giftLinkListVariants = tv({
	slots: {
		root: 'flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1',
		link: '',
		domain: 'hidden',
		overflow: 'text-xs font-semibold text-muted-foreground',
	},
	variants: {
		display: {
			chip: {},
			row: {
				root: 'flex-col items-start gap-y-0',
				link: 'min-h-(--size-control-lg)',
				domain: 'inline-block font-normal text-muted-foreground',
			},
		},
	},
	defaultVariants: {
		display: 'chip',
	},
});

export type GiftLinkListDisplay = keyof typeof giftLinkListVariants.variants.display;
