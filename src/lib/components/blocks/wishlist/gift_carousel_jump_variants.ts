import { tv } from 'tailwind-variants';

/**
 * Sticky jump bar above the Carousel rows: one in-page chip link per row, the current row's chip
 * filled. The link is the 40 px touch target around the 32 px chip face, and the bar's block
 * padding keeps the face's focus ring and the toolbar's shadow clear of the scroll clip. Its surface
 * matches the toolbar mask: the page background, or only a blur over a wishlist backdrop.
 */
export const giftCarouselJumpVariants = tv({
	slots: {
		bar: 'sticky top-(--gift-carousel-chrome-top) z-(--z-sticky) flex gap-1.5 overflow-x-auto overscroll-x-contain border-b-2 border-border bg-(--app-page-background) px-(--page-gutter) pt-[calc(2px+var(--depth-clearance))] pb-0.5 [scrollbar-width:none] in-data-[wishlist-backdrop]:bg-transparent in-data-[wishlist-backdrop]:backdrop-blur-[10px] [&::-webkit-scrollbar]:hidden',
		link: 'group inline-flex h-(--size-control-lg) flex-none items-center no-underline outline-none',
		face: 'inline-flex h-(--size-control-md) items-center gap-1.5 rounded-full border-2 border-[color-mix(in_oklab,var(--ink)_35%,transparent)] bg-card px-3 text-(length:--text-sm) font-bold whitespace-nowrap text-foreground group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-ring group-focus-visible:outline-solid group-aria-[current=location]:border-ink group-aria-[current=location]:bg-primary group-aria-[current=location]:text-primary-foreground',
		count: 'font-semibold text-muted-foreground tabular-nums group-aria-[current=location]:text-[color-mix(in_oklab,var(--primary-foreground)_85%,transparent)]',
	},
});
