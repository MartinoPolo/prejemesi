import { tv } from 'tailwind-variants';

/**
 * Anime-sky empty state (issue #102 REQ-16, `anime-dashboard.html`): dashed
 * sketchbook frame, doodle emoji with a hard drop shadow, DynaPuff heading.
 */
export const emptyStateVariants = tv({
	slots: {
		root: 'flex flex-col items-center gap-2.5 rounded-panel border-[3px] border-dashed border-muted-foreground px-6 py-12 text-center',
		glyph: 'text-[44px] leading-none drop-shadow-[2px_3px_0_var(--hard-shadow)]',
		title: 'font-heading text-2xl font-semibold text-foreground',
		description: 'max-w-[44ch] text-[15px] leading-relaxed text-muted-foreground',
	},
});
