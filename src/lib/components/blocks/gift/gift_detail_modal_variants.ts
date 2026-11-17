import { tv } from 'tailwind-variants';

/**
 * The gift editor dialog: a fixed-height desktop dialog whose main screen and framing step share
 * one size, and a full-screen sheet on phones. With a phone keyboard open the dialog reaches down
 * to the keyboard, the footer hides and Save moves into the title row.
 */
export const giftDetailModalVariants = tv({
	slots: {
		content: [
			'sm:h-[85dvh] sm:max-w-[1100px] sm:top-[7.5dvh]',
			'max-sm:top-2 max-sm:h-[calc(100dvh-1rem)] max-sm:max-h-none max-sm:max-w-[calc(100%-1rem)]',
			'keyboard-open:top-[calc(var(--visual-viewport-top)+6px)] keyboard-open:bottom-(--keyboard-inset) keyboard-open:h-auto keyboard-open:max-h-none keyboard-open:max-w-[calc(100%-12px)] keyboard-open:rounded-b-none keyboard-open:border-b-0',
		],
		// The title shares the close sticker's row and height at every width.
		// Scoped like the scroll layout's own header padding so these insets replace it.
		header: 'flex-row items-center gap-2 text-left in-data-[dialog-layout=scroll]:pt-(--overlay-close-inset) in-data-[dialog-layout=scroll]:pb-2 in-data-[dialog-layout=scroll]:pe-(--overlay-close-clearance)',
		// The top padding centres the first line on the close sticker, so a title that wraps at
		// enlarged text grows downward instead of drifting off the sticker.
		title: 'min-h-(--size-control-lg) min-w-0 flex-1 pt-[max(0px,calc((var(--size-control-lg)_-_1lh)/2))] text-left break-words',
		// The heading face reads „z“ like „2“, so the count uses the body face.
		titleCount: 'font-sans text-xl font-medium text-muted-foreground max-sm:text-base',
		keyboardSave: 'hidden shrink-0 keyboard-open:inline-flex',
		// Same variant as the shared scroll-body padding so tailwind-merge replaces it.
		body: 'in-data-[dialog-layout=scroll]:pb-4',
		// Fields come first in the DOM for phones; desktop moves the preview rail to the left.
		mainGrid:
			'flex flex-col gap-6 sm:grid sm:grid-cols-[minmax(15rem,18.75rem)_minmax(0,1fr)] sm:items-start sm:gap-8',
		fields: 'flex min-w-0 flex-col gap-4 sm:col-start-2 sm:row-start-1',
		rail: 'flex min-w-0 flex-col gap-3 sm:col-start-1 sm:row-start-1',
		formField: 'flex flex-col gap-1.5',
		// Five lines plus the textarea's padding and border; the form column then ends near the rail.
		descriptionInput: 'sm:min-h-[calc(5lh+1rem+5px)]',
		// Price, currency, quantity and priority share one row on wide screens and pair up below.
		formRow:
			'grid grid-cols-2 gap-x-3 gap-y-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)]',
		// Fields in a row share its label and control tracks, so a label that wraps in one
		// field moves every control in the row together instead of offsetting only its own.
		formRowField: 'row-span-2 grid min-w-0 grid-rows-subgrid gap-y-1.5',
		formLabelRow: 'flex min-h-6 items-center justify-between gap-2',
		// Phones end the body with the destructive actions; wider screens lead the footer with them.
		bodyActions: 'flex flex-col gap-(--nested-control-gap)',
		footer: 'max-sm:flex-row keyboard-open:hidden',
		footerPrimary: 'max-sm:flex-1',
		footerHint: 'text-sm text-muted-foreground',
	},
	variants: {
		/** Without a back sticker the title starts at the header's edge; the header clears the close. */
		withBack: {
			// Phones keep the step title on the Back and Close row; the full title stays its accessible name.
			true: { title: 'max-sm:truncate max-sm:text-xl' },
			false: { title: 'in-data-close-button:px-0' },
		},
	},
});

export type GiftDetailModalMode = 'create' | 'edit';
