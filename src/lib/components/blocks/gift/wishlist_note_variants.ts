import { tv } from 'tailwind-variants';

/** The wishlist description shown as a message from the list's author, below the hero. */
export const wishlistNoteVariants = tv({
	slots: {
		/** One text line tall: the controls' negative block margins keep the alert icon aligned. */
		headerRow: 'flex min-w-0 items-center gap-2',
		label: 'min-w-0 flex-1',
		/**
		 * The negative margins shrink the responsive buttons (`lg`, `md` from `sm`) to the alert's
		 * 20px line and keep the × glyph the same distance from the edge at both sizes.
		 */
		controls:
			'my-[calc((--spacing(5)-var(--size-control-lg))/2)] me-[calc((--spacing(5)-var(--size-control-lg))/2)] flex shrink-0 items-center gap-1 sm:my-[calc((--spacing(5)-var(--size-control-md))/2)] sm:me-[calc((--spacing(5)-var(--size-control-md))/2)]',
		/** Keeps the author's line breaks and breaks words too long for the column. */
		body: 'mt-1 whitespace-pre-line break-words',
		foldedText: 'min-w-0 flex-1 truncate',
		/** Below `sm` the line has no room for the author, but screen readers still announce it. */
		foldedLabel: 'sr-only font-heading font-medium sm:not-sr-only',
		/** Takes focus when the confirmation opens, so screen readers read the question. */
		confirmTitle: 'outline-none',
		confirmActions: 'flex flex-wrap gap-(--nested-control-gap)',
	},
});
