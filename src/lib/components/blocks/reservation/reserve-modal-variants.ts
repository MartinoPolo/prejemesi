import { tv } from 'tailwind-variants';

export const reserveModalVariants = tv({
	slots: {
		content: 'max-w-md',
		body: 'flex flex-col gap-4 px-6 pb-6 pt-2',
		giftSummary: 'flex items-center gap-3 rounded-lg bg-muted p-3',
		giftImage: 'size-12 flex-shrink-0 overflow-hidden rounded-md bg-muted',
		giftImageElement: 'size-full object-cover',
		giftImagePlaceholder: 'flex size-full items-center justify-center',
		giftInfo: 'min-w-0 flex-1',
		giftName: 'truncate text-sm font-semibold text-foreground',
		giftAvailability: 'text-xs text-muted-foreground',
		formField: 'flex flex-col gap-1.5',
		quantityRow: 'flex items-center gap-3',
		quantityLabel: 'text-sm text-muted-foreground',
		authPrompt: 'flex flex-col gap-2 rounded-lg border border-border bg-muted/50 p-3',
		authPromptText: 'text-xs text-muted-foreground',
		authPromptLinks: 'flex items-center gap-2 text-xs',
		separator: 'text-muted-foreground',
		errorText: 'text-xs text-destructive',
		actions: 'flex items-center justify-end gap-2',
	},
});
