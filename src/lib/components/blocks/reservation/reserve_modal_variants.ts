import { tv } from 'tailwind-variants';

export const reserveModalVariants = tv({
	slots: {
		// `sm:max-w-lg` on the base Dialog.Content wins over a plain `max-w-md` override at
		// >=640px (tailwind-merge treats different responsive modifiers as non-conflicting, and
		// the `sm:` rule sits later in the cascade) — repeat the override at the same modifier
		// so it actually replaces the base breakpoint value instead of losing to it.
		content: 'max-w-md sm:max-w-md',
		// `min-w-0`: this is a CSS Grid item (direct child of Dialog.Content's `grid`), which
		// unlike flex items gets an automatic minimum size on BOTH axes. Without it, an
		// unbreakable descendant (the nowrap gift name) sets this element's min-content width,
		// which can exceed the dialog's own max-width and drag the whole layout wider.
		body: 'min-w-0 flex flex-col gap-4 px-6 pb-6 pt-2',
		giftSummary: 'flex items-center gap-3 rounded-[12px] border-2 border-ink bg-surface p-3',
		giftImage:
			'size-12 flex-shrink-0 -rotate-3 overflow-hidden rounded-[10px] border-2 border-ink bg-tint',
		giftImageElement: 'size-full object-cover',
		giftImagePlaceholder: 'flex size-full items-center justify-center',
		giftInfo: 'min-w-0 flex-1',
		giftName: 'line-clamp-2 font-heading text-sm font-semibold text-foreground',
		giftAvailability: 'text-xs font-semibold text-muted-foreground',
		formField: 'flex flex-col gap-1.5',
		quantityRow: 'flex items-center gap-3',
		quantityLabel: 'text-sm text-muted-foreground',
		authPrompt:
			'flex flex-col gap-2 rounded-[12px] border-2 border-dashed border-ink-faint p-3',
		authPromptText: 'text-xs text-muted-foreground',
		authPromptLinks: 'flex items-center gap-2 text-xs',
		separator: 'text-muted-foreground',
		errorText: 'text-xs text-destructive',
		actions: 'flex items-center justify-end gap-2',
	},
});
