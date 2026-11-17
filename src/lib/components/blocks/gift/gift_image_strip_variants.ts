import { tv } from 'tailwind-variants';

/**
 * Editor gallery strip (#591, #706): small tiles that wrap on desktop and scroll in one row on
 * mobile. The list insets leave room for the selected tile's ring and the corner controls' shadows.
 * The inline orientation puts the heading beside the tiles and the hint at the far end.
 */
export const giftImageStripVariants = tv({
	slots: {
		root: 'flex min-w-0 flex-col gap-1.5',
		heading: 'flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1',
		headingTitle: 'text-[0.8125rem] font-semibold',
		headingHint: 'text-xs text-muted-foreground',
		list: 'm-0 flex list-none flex-nowrap gap-2.5 overflow-x-auto p-[0.4375rem] pe-[calc(0.4375rem+var(--elevation-compact-offset))] pb-[calc(0.625rem+var(--elevation-compact-offset))] [scrollbar-width:thin] sm:flex-wrap sm:gap-2 sm:overflow-x-visible sm:pb-[calc(0.4375rem+var(--elevation-compact-offset))]',
		tile: 'group/tile relative size-13 shrink-0',
		select: [
			'block size-full cursor-pointer overflow-hidden rounded-[0.625rem] border-2 border-ink-faint bg-surface p-0 outline-none hover:border-edge',
			'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-disabled:cursor-not-allowed',
			'group-data-selected/tile:border-(length:--border-w) group-data-selected/tile:border-edge group-data-selected/tile:ring-[2.5px] group-data-selected/tile:ring-brand group-data-selected/tile:ring-offset-[3px] group-data-selected/tile:ring-offset-card',
		],
		emptySource:
			'flex size-full items-center justify-center text-muted-foreground [&_svg]:size-5',
		// Controls 2 px into the corners keep the tile's centre free for selecting; a pseudo-element
		// pads each hit area to 24 px without reaching the neighbouring control's. They show, and
		// take presses, only on the selected, hovered or focused tile, so a hidden control never
		// catches a tap meant to select; coarse pointers have no hover, so there they always show.
		cornerControl: [
			'absolute top-0.5 z-1 size-5.5 rounded-md before:absolute before:-inset-px before:content-[""] [&_svg]:size-3',
			'pointer-events-none opacity-0 transition-opacity duration-(--duration-normal)',
			'group-focus-within/tile:pointer-events-auto group-focus-within/tile:opacity-100 group-hover/tile:pointer-events-auto group-hover/tile:opacity-100 group-data-selected/tile:pointer-events-auto group-data-selected/tile:opacity-100 pointer-coarse:pointer-events-auto pointer-coarse:opacity-100',
			// Dimmed only where it is visible, so a hidden control stays hidden while the strip is locked.
			'group-focus-within/tile:aria-disabled:opacity-45! group-hover/tile:aria-disabled:opacity-45! group-data-selected/tile:aria-disabled:opacity-45! pointer-coarse:aria-disabled:opacity-45!',
		],
		grip: 'start-0.5 cursor-grab touch-none active:cursor-grabbing',
		remove: 'end-0.5',
		cover: 'pointer-events-none absolute inset-x-1 bottom-1 truncate rounded-full bg-primary px-1 text-center text-[0.625rem] leading-[1.0625rem] font-extrabold text-primary-foreground',
		pendingTile:
			'flex size-13 shrink-0 items-center justify-center rounded-[0.625rem] border-2 border-dashed border-edge bg-surface text-muted-foreground',
		addTile: [
			'flex size-13 shrink-0 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-[0.625rem] border-2 border-dashed border-edge bg-card p-0 text-[0.6875rem] font-bold [&_svg]:size-4.5',
			'outline-none hover:bg-panel-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-disabled:cursor-not-allowed aria-disabled:opacity-45 aria-disabled:hover:bg-card',
		],
		limitNote: 'font-medium text-muted-foreground',
	},
	variants: {
		orientation: {
			stacked: {},
			inline: {
				root: 'sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3',
				heading: 'max-sm:sr-only sm:contents',
				headingHint: 'sm:order-last sm:ms-auto sm:max-w-60 sm:text-end',
			},
		},
	},
	defaultVariants: { orientation: 'stacked' },
});

export type GiftImageStripOrientation = keyof typeof giftImageStripVariants.variants.orientation;
