import { tv } from 'tailwind-variants';

/**
 * Anime-sky wishlist header (issue #102 REQ-12). The hero frame paper is drawn by
 * WishlistHeroFrame, the occasion emblem by WishlistHeroEmblem and the taped Blok
 * polaroid in WishlistHeader's scoped <style> block — the multi-layer background
 * images don't translate to utility classes.
 */
export const wishlistHeaderVariants = tv({
	slots: {
		root: 'flex flex-col gap-3 sm:gap-6',
		/** Keeps clear of the frame's end decoration even without hero actions. */
		headerText: 'min-w-0 flex-1 sm:pe-(--hero-copy-end-minimum)',
		/** „Pro: {recipient}" line above the title (name bold, prefix lighter) — all lists. */
		recipientLine: 'reveal text-[17px] text-muted-foreground',
		/** Groups the name with its edit pencil so the ghost button truly centers on the name's own box, not the line's mixed font sizes (issue #157). */
		recipientNameGroup: 'inline-flex items-center gap-1.5',
		/** Recipient's Google/uploaded avatar, shown only when one is available (issue #158). */
		recipientAvatar: 'shrink-0',
		recipientName: 'font-heading text-[26px] font-semibold text-ink',
		title: 'reveal reveal-2 mt-0.5 text-[clamp(28px,4vw,42px)] leading-tight font-semibold',
		description: 'reveal reveal-2 mt-1 max-w-2xl text-base text-muted-foreground',
		metaRow: 'reveal reveal-3 mt-2 flex flex-wrap items-center gap-2.5',
		/** Emblem stand-ins: from 960 px the occasion emblem carries occasion and countdown. */
		occasionChip: 'min-[960px]:hidden',
		countdownChip: 'hidden max-[960px]:inline-flex bg-accent-loud text-accent-loud-foreground',
		managersLine: 'text-sm text-muted-foreground',
		actionRow: 'reveal reveal-4 mt-3 flex flex-wrap items-center gap-2',
		editImageButton:
			'absolute inset-x-2 top-2 z-10 opacity-0 transition-opacity group-hover/polaroid:opacity-100 focus-visible:opacity-100',
	},
});
