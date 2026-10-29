import { tv } from 'tailwind-variants';

/**
 * Anime-sky sticker wishlist card (issue #102 REQ-16, `anime-dashboard.html`):
 * ink border, hard offset shadow, coherent lift, banner with the title on a small
 * rotated label sticker and the status chip pinned top-right. The body and title
 * plate take the wishlist's own palette (#532). Archived cards dim, desaturate,
 * and stop lifting. The overview uses `large` (Nedávné) and `compact` (category
 * rows); other pages keep `default`.
 */
export const wishlistCardVariants = tv({
	slots: {
		root: 'group/card relative isolate flex h-full cursor-pointer flex-col rounded-panel',
		surface:
			'elevation-ordinary pointer-events-auto relative flex size-full flex-col rounded-panel bg-wishlist-card-body transition-[translate,scale,box-shadow] duration-(--duration-normal) ease-(--ease-standard)',
		border: 'pointer-events-none absolute inset-0 z-[1] rounded-panel border-[2.5px] border-ink',
		banner: 'relative flex shrink-0 flex-col items-start justify-end overflow-hidden rounded-t-[calc(var(--radius-panel)-2.5px)] border-b-[2.5px] border-ink',
		/** Notebook dot pattern over the tint fallback (hidden when a real photo fills the banner). */
		bannerPattern:
			'pointer-events-none absolute inset-0 bg-[radial-gradient(var(--pattern-dot)_1.4px,transparent_1.5px)] bg-size-[18px_18px]',
		bannerTitle:
			'relative z-[1] max-w-full -rotate-1 truncate rounded-[10px] border-2 border-ink bg-wishlist-card-plate font-heading font-semibold text-wishlist-card-plate-foreground shadow-sticker-sm',
		statusBadge: 'absolute z-[1]',
		body: 'flex flex-1 flex-col',
		metaRow: 'flex flex-wrap items-center gap-1.5',
		metaStack: 'flex min-w-0 flex-col gap-1.5',
		metaText: 'truncate text-[13px] text-muted-foreground',
		ownerRow: 'flex items-center gap-2 text-sm text-muted-foreground',
		progressWrap: 'flex flex-col gap-1.5',
		progressLabelRow:
			'flex items-center justify-between text-[13px] font-bold text-muted-foreground',
		progressValue: 'font-extrabold text-brand-link',
		availableCount: 'text-[13px] font-semibold text-muted-foreground',
		divider: 'my-0.5',
		actions: 'flex flex-wrap items-center gap-1.5',
		actionsEnd: 'ml-auto flex items-center gap-1.5',
	},
	variants: {
		archived: {
			true: {
				root: 'opacity-70 grayscale-[0.7]',
				surface: 'bg-[color-mix(in_oklab,var(--wishlist-card-body)_82%,var(--surface))]',
			},
			false: { root: 'elevation-owner elevation-owner-raised' },
		},
		size: {
			default: {
				banner: 'h-32 p-3.5',
				bannerTitle: 'px-3 py-1 text-[17px]',
				statusBadge: 'top-3 right-3',
				body: 'gap-2.5 px-4 pt-3.5 pb-4',
			},
			large: {
				banner: 'h-[172px] p-4 max-sm:h-[150px]',
				bannerTitle: 'px-3.5 py-[5px] text-[20px] max-sm:text-[18px]',
				statusBadge: 'top-3 right-3',
				body: 'gap-3 px-[18px] pt-4 pb-[18px]',
			},
			compact: {
				banner: 'h-[92px] p-2.5 max-sm:h-[84px]',
				bannerTitle: 'px-2.5 py-[3px] text-[15px] max-sm:text-[14.5px]',
				statusBadge: 'top-2 right-2 px-[9px] py-px text-[11.5px]',
				body: 'gap-2 px-3.5 pt-2.5 pb-3.5',
			},
		},
	},
	defaultVariants: {
		archived: false,
		size: 'default',
	},
});

export type WishlistCardSize = keyof typeof wishlistCardVariants.variants.size;
