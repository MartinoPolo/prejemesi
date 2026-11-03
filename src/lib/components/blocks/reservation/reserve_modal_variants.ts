import { tv } from 'tailwind-variants';

export const reserveModalVariants = tv({
	slots: {
		// max-w now comes from Dialog.Content's `size="md"` prop (#210) — no more sm: duplication workaround needed.
		content: '',
		// min-w-0: grid items don't shrink below content size by default (unlike flex); the nowrap gift name would else widen the dialog.
		body: 'min-w-0 flex flex-col gap-4 px-6 pb-6 pt-2',
		// Keyboard open on a phone: context compacts and the actions stay pinned above the keyboard.
		giftSummary:
			'flex items-center gap-3 rounded-[12px] border-2 border-ink bg-surface p-3 keyboard-open:p-1.5',
		giftImage:
			'size-12 flex-shrink-0 -rotate-3 overflow-hidden rounded-[10px] border-2 border-ink bg-tint keyboard-open:size-8',
		giftImageElement: 'size-full object-cover',
		giftImagePlaceholder: 'flex size-full items-center justify-center',
		giftInfo: 'min-w-0 flex-1',
		giftName: 'line-clamp-2 font-heading text-sm font-semibold text-foreground',
		giftAvailability: 'text-xs font-semibold text-muted-foreground',
		formField: 'flex flex-col gap-1.5',
		quantityRow: 'flex items-center gap-3',
		quantityLabel: 'text-sm text-muted-foreground',
		authPrompt:
			'flex flex-col gap-2 rounded-[12px] border-2 border-dashed border-ink-faint p-3 keyboard-open:hidden',
		authPromptText: 'text-xs text-muted-foreground',
		authPromptLinks: 'flex items-center gap-2 text-xs',
		separator: 'text-muted-foreground',
		actions:
			'flex items-center justify-end gap-(--nested-control-gap) keyboard-open:sticky keyboard-open:bottom-0 keyboard-open:-mx-6 keyboard-open:-mb-6 keyboard-open:border-t keyboard-open:border-border keyboard-open:bg-background keyboard-open:px-6 keyboard-open:py-3 keyboard-open:*:flex-1',
	},
});
