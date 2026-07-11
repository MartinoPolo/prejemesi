import { tv } from 'tailwind-variants';

export const giftDetailModalVariants = tv({
	slots: {
		content: 'sm:max-w-[900px] max-h-[90dvh] overflow-hidden p-0 gap-0 max-w-[calc(100%-1rem)]',
		// max-h caps the body at the dialog height so it never outgrows it. Without the cap
		// the grid stretches to its content height in Crop mode (the crop preview lets the
		// column grow), pushing the form past 90dvh where the dialog clips it with no
		// scrollbar. Capped here, the detail column's own overflow-y-auto scrolls instead.
		body: 'grid grid-cols-1 sm:grid-cols-[45%_55%] min-h-[400px] sm:min-h-[520px] max-h-[90dvh]',
		// Dotted notebook mat behind the photo (issue #102 round-2 delta): letterboxed
		// images keep the mat visible; a dashed ink seam separates image and form columns.
		imageColumn:
			'relative overflow-hidden border-b-2 border-dashed border-ink-faint bg-surface bg-[radial-gradient(var(--pattern-dot)_1.4px,transparent_1.5px)] bg-size-[18px_18px] sm:border-b-0 sm:border-r-2 h-[200px] sm:h-auto',
		imagePlaceholder: 'flex size-full flex-col items-center justify-center gap-3',
		image: 'size-full object-cover',
		detailColumn: 'flex flex-col gap-0 overflow-y-auto p-5 sm:p-7',
		formField: 'flex flex-col gap-1.5',
		formLabel: 'text-sm font-medium text-foreground',
		formRow: 'grid grid-cols-2 gap-3',
		formActions: 'mt-auto flex flex-col gap-2 pt-4',
		submitButton: 'w-full',
		deleteButton: 'w-full',
		receivedButton: 'w-full',
		imageInputRow: 'flex flex-col gap-2',
		imageTabRow: 'flex gap-1.5',
		imageTab:
			'cursor-pointer rounded-full border-2 px-3 py-1 text-xs font-semibold transition-colors',
	},
	variants: {
		imageTabActive: {
			true: {
				imageTab: 'border-ink bg-primary text-primary-foreground',
			},
			false: {
				imageTab:
					'border-ink bg-card text-foreground-muted hover:bg-accent hover:text-foreground',
			},
		},
	},
	defaultVariants: {
		imageTabActive: false,
	},
});

export type GiftDetailModalMode = 'create' | 'edit';
