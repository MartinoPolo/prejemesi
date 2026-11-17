import { tv } from 'tailwind-variants';

/**
 * Editor gallery strip (#591, #706): small tiles that wrap on desktop and scroll in one row on
 * mobile. The list insets leave room for the selected tile's ring and the corner controls'
 * overhang, shadows and focus outlines; phones need more because their scrolling list clips.
 * The inline orientation puts the heading beside the tiles and the hint at the far end; phones
 * show only the hint, and only while it offers to undo a removal.
 */
export const giftImageStripVariants = tv({
	slots: {
		root: 'flex min-w-0 flex-col gap-1.5',
		heading: 'flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1',
		headingTitle: 'text-[0.8125rem] font-semibold',
		headingHint: 'text-xs text-muted-foreground',
		// Columns keep 4 px between one tile's overhanging remove control and the next tile's grip;
		// rows clear the ring.
		list: 'm-0 flex list-none flex-nowrap gap-x-4 gap-y-3 overflow-x-auto p-2.5 pe-[calc(0.625rem+var(--elevation-compact-offset))] pb-[calc(0.625rem+var(--elevation-compact-offset))] [scrollbar-width:thin] sm:flex-wrap sm:overflow-x-visible sm:p-[0.4375rem] sm:pe-[calc(0.4375rem+var(--elevation-compact-offset))] sm:pb-[calc(0.4375rem+var(--elevation-compact-offset))]',
		tile: 'group/tile relative size-13 shrink-0',
		select: [
			'block size-full cursor-pointer overflow-hidden rounded-[0.625rem] border-2 border-ink-faint bg-surface p-0 outline-none hover:border-edge',
			'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-disabled:cursor-not-allowed',
			'group-data-selected/tile:border-(length:--border-w) group-data-selected/tile:border-edge group-data-selected/tile:ring-[2.5px] group-data-selected/tile:ring-brand group-data-selected/tile:ring-offset-[3px] group-data-selected/tile:ring-offset-card',
		],
		emptySource:
			'flex size-full items-center justify-center text-muted-foreground [&_svg]:size-5',
		// 24 px controls centred 6 px inside the top corners overhang the tile by 6 px, leaving its
		// centre and lower part free for selecting; the list gaps keep neighbouring tiles' controls
		// apart. They show, and take presses, only on the selected, hovered or focused tile, so a
		// hidden control never catches a tap meant to select; coarse pointers have no hover, so
		// there they always show.
		cornerControl: [
			'absolute -top-1.5 z-1 size-6 rounded-md',
			'pointer-events-none opacity-0 transition-opacity duration-(--duration-normal)',
			'group-focus-within/tile:pointer-events-auto group-focus-within/tile:opacity-100 group-hover/tile:pointer-events-auto group-hover/tile:opacity-100 group-data-selected/tile:pointer-events-auto group-data-selected/tile:opacity-100 pointer-coarse:pointer-events-auto pointer-coarse:opacity-100',
			// Dimmed only where it is visible, so a hidden control stays hidden while the strip is locked.
			'group-focus-within/tile:aria-disabled:opacity-45! group-hover/tile:aria-disabled:opacity-45! group-data-selected/tile:aria-disabled:opacity-45! pointer-coarse:aria-disabled:opacity-45!',
		],
		grip: '-start-1.5 cursor-grab touch-none active:cursor-grabbing',
		remove: '-end-1.5',
		// The danger hover tint mixes over the card, not transparency, so the face stays opaque
		// over the photo.
		removeSurface: 'group-hover:bg-[color-mix(in_oklab,var(--status-danger)_10%,var(--card))]',
		cover: 'pointer-events-none absolute inset-x-1 bottom-1 truncate rounded-full bg-primary px-1 text-center text-[0.625rem] leading-[1.0625rem] font-extrabold text-primary-foreground',
		pendingTile:
			'flex size-13 shrink-0 items-center justify-center rounded-[0.625rem] border-2 border-dashed border-edge bg-surface text-muted-foreground',
		addTile: [
			'flex size-13 shrink-0 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-[0.625rem] border-2 border-dashed border-edge bg-card p-0 text-[0.6875rem] font-bold [&_svg]:size-4.5',
			'outline-none hover:bg-panel-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-disabled:cursor-not-allowed aria-disabled:opacity-45 aria-disabled:hover:bg-card',
		],
		limitNote: 'font-medium text-muted-foreground',
		removalUndo: 'inline-flex items-center gap-2',
		// Overlaps the heading's line box so offering the undo adds no height.
		removalUndoButton: '-my-1 aria-disabled:opacity-45',
	},
	variants: {
		orientation: {
			stacked: {},
			inline: {
				root: 'sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3',
				heading: 'contents',
				headingTitle: 'max-sm:sr-only',
				headingHint: 'max-sm:sr-only sm:order-last sm:ms-auto sm:max-w-60 sm:text-end',
			},
		},
		offersRemovalUndo: {
			true: {},
			false: {},
		},
	},
	compoundVariants: [
		{
			orientation: 'inline',
			offersRemovalUndo: true,
			class: { headingHint: 'max-sm:not-sr-only' },
		},
	],
	defaultVariants: { orientation: 'stacked', offersRemovalUndo: false },
});

export type GiftImageStripOrientation = keyof typeof giftImageStripVariants.variants.orientation;
