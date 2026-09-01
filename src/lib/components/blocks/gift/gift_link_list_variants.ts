import { tv } from 'tailwind-variants';

/**
 * Gift purchase links (`anime-sky-final.html` .tag-link): `chip` is the
 * compact ~26px tag pill cards/list rows use (unchanged default); `row`
 * (issue #165) is the full-width ≥44px touch target the gift detail modal
 * uses, pairing a leading domain pill with a trailing title.
 */
export const giftLinkListVariants = tv({
	slots: {
		root: 'flex flex-wrap items-center gap-1.5',
		link: 'inline-flex max-w-full items-center gap-1 rounded-full border-2 border-ink bg-card px-2.5 py-0.5 text-[11.5px] font-bold text-[color:var(--link)] no-underline transition-colors hover:bg-link-tint',
		icon: 'size-3 flex-shrink-0',
		chipLabel: 'truncate',
		domain: 'hidden',
		title: 'hidden',
		overflow: 'text-xs font-semibold text-muted-foreground',
	},
	variants: {
		display: {
			chip: {},
			row: {
				root: 'flex flex-col gap-2',
				link: 'min-h-(--size-control-lg) w-full items-center gap-2.5 rounded-[10px] border-2 border-ink bg-card px-3 py-2 text-sm font-normal text-foreground transition-[translate,scale,box-shadow] duration-(--duration-normal) ease-(--ease-standard) delay-0 motion-safe:hover:-translate-y-0.5 hover:bg-link-tint hover:shadow-sticker-sm motion-reduce:transition-none',
				icon: 'size-3.5 flex-shrink-0',
				chipLabel: 'hidden',
				domain: 'inline-flex flex-none items-center gap-1 rounded-full border-2 border-ink bg-link-tint px-2.5 py-0.5 text-[12.5px] font-extrabold text-[color:var(--link)]',
				title: 'truncate font-semibold text-muted-foreground',
			},
		},
	},
	defaultVariants: {
		display: 'chip',
	},
});

export type GiftLinkListDisplay = keyof typeof giftLinkListVariants.variants.display;
