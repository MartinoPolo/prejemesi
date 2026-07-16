import { tv } from 'tailwind-variants';

/**
 * Anime-sky notebook header (issue #102 REQ-12). The spiral-notebook panel
 * (punch holes, red margin line, ruled lines), the taped polaroid photo and the
 * sticky-note countdown are drawn in WishlistHeader's scoped <style> block —
 * the multi-layer background images don't translate to utility classes.
 */
export const wishlistHeaderVariants = tv({
	slots: {
		root: 'flex flex-col gap-3',
		headerText: 'min-w-0 flex-1',
		/** „Pro: {recipient}" line above the title (name bold, prefix lighter) — all lists. */
		recipientLine: 'reveal text-[17px] text-ink-soft',
		/** Groups the name with its edit pencil so the ghost button truly centers on the name's own box, not the line's mixed font sizes (issue #157). */
		recipientNameGroup: 'inline-flex items-center gap-1',
		recipientName: 'font-heading text-[26px] font-semibold text-ink',
		title: 'reveal reveal-2 mt-0.5 text-[clamp(28px,4vw,42px)] leading-tight font-semibold',
		description: 'reveal reveal-2 mt-1 max-w-2xl text-base text-ink-soft',
		metaRow: 'reveal reveal-3 mt-2 flex flex-wrap items-center gap-2.5',
		/** Sticky-note stand-in chip: only rendered below the sticky-note breakpoint. */
		countdownChip: 'hidden max-[960px]:inline-flex bg-accent-loud text-accent-loud-foreground',
		managersLine: 'text-sm text-ink-soft',
		actionRow: 'reveal reveal-4 mt-3 flex flex-wrap items-center gap-2',
		editImageButton:
			'absolute inset-x-2 top-2 z-10 opacity-0 transition-opacity group-hover/polaroid:opacity-100 focus-visible:opacity-100',
	},
});
