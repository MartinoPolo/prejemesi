import { tv } from 'tailwind-variants';

export const giftDetailModalVariants = tv({
	slots: {
		// Flex column so the body inherits a definite height when the dialog is
		// capped at 90dvh – that lets the detail column pin its footer and scroll
		// only the fields (#116 follow-up, GiftDraftDialog precedent).
		content:
			'flex flex-col sm:max-w-[900px] max-h-[90dvh] overflow-hidden p-0 gap-0 max-w-[calc(100%-1rem)]',
		// Explicit row sizing keeps both columns inside the capped dialog height:
		// mobile stacks the fixed-height image row above the flexible form row.
		body: 'grid grid-cols-1 sm:grid-cols-[45%_55%] grid-rows-[auto_minmax(0,1fr)] sm:grid-rows-[minmax(0,1fr)] min-h-[400px] sm:min-h-[520px]',
		// Dotted notebook mat behind the photo (issue #102 round-2 delta): letterboxed
		// images keep the mat visible; a dashed ink seam separates image and form columns.
		// The mobile height fits the display-mode toggle + preview + tile row (#116 round 3).
		imageColumn:
			'relative overflow-hidden border-b-2 border-dashed border-ink-faint bg-surface bg-[radial-gradient(var(--pattern-dot)_1.4px,transparent_1.5px)] bg-size-[18px_18px] sm:border-b-0 sm:border-r-2 h-[260px] sm:h-auto',
		imagePlaceholder: 'flex size-full flex-col items-center justify-center gap-3',
		image: 'size-full object-cover',
		detailColumn: 'flex min-h-0 flex-col gap-0 overflow-hidden',
		detailScroll: 'min-h-0 flex-1 overflow-y-auto p-5 sm:p-7',
		formField: 'flex flex-col gap-1.5',
		formLabel: 'text-sm font-medium text-foreground',
		formRow: 'grid grid-cols-2 gap-3',
		// Pinned outside the scroll region – always visible in create and edit mode.
		formActions:
			'flex flex-col gap-2 border-t-2 border-dashed border-ink-faint px-5 py-4 sm:px-7',
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
