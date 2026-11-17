import { tv } from 'tailwind-variants';

/**
 * The gift editor's framing step (#706): on desktop the Card view spans both grid rows so the
 * background and keyboard bar sits beside its lower part, keeping the step free of scrolling.
 */
export const giftFramingStepVariants = tv({
	slots: {
		root: 'flex flex-col gap-3',
		sideBySide:
			'grid grid-cols-[minmax(0,18.5rem)_auto_minmax(0,1fr)] grid-rows-[auto_1fr] gap-x-5 gap-y-3',
		cardView: 'row-span-2',
		copyColumn: 'flex max-w-44 flex-col items-stretch gap-2 self-center text-center',
		note: 'text-xs text-muted-foreground',
		listColumn: 'flex min-w-0 flex-col gap-3',
		sameSquarePanel:
			'flex flex-col gap-2 rounded-panel border-2 border-border bg-surface-2 p-3 text-sm',
		sameSquareHeading: 'text-xs font-semibold text-muted-foreground',
		sameSquareSamples: 'flex items-center gap-4',
		sample: 'flex items-center gap-2',
		sampleImage: 'overflow-hidden rounded-md border-2 border-edge',
		backgroundBar:
			'col-span-2 col-start-2 row-start-2 flex flex-wrap items-center justify-between gap-3 self-end border-t border-border pt-3',
		backgroundGroup: 'flex items-center gap-3',
		backgroundLabel: 'text-xs font-semibold',
		keyboardHints: '',
		compactActions: 'flex items-center justify-between gap-(--nested-control-gap)',
	},
	variants: {
		keyLegend: {
			true: {
				keyboardHints: 'flex flex-wrap items-center gap-1 text-xs text-muted-foreground',
			},
			false: { keyboardHints: 'sr-only' },
		},
		/** The reservation row and the carousel show the same square at their own sizes. */
		sample: {
			reservation: { sampleImage: 'size-10' },
			carousel: { sampleImage: 'size-18' },
		},
	},
});

/**
 * One framing view: the Card fills its 4:3 photo box, while the List row frames the saved square
 * shown whole inside its box. The card outline nests inside the card's corner (inner radius =
 * outer radius − border − the outline's inset).
 */
export const giftFramingViewVariants = tv({
	slots: {
		root: 'flex min-w-0 flex-col gap-2',
		headingRow: 'flex min-w-0 items-center justify-between gap-2',
		heading: 'min-w-0 truncate text-sm',
		headingName: 'font-heading text-base font-semibold',
		headingDetail: 'text-xs text-muted-foreground',
		surfaceBox: '',
		outline: '',
	},
	variants: {
		target: {
			square: {
				surfaceBox: 'size-full',
				outline: 'rounded-t-[max(0px,calc(var(--radius-panel)-var(--border-w)-0.1875rem))]',
			},
			thumb: {
				surfaceBox: 'absolute inset-0 m-auto aspect-square max-h-full max-w-full',
				outline: 'rounded-sm',
			},
		},
	},
});
