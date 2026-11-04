import { tv } from 'tailwind-variants';

/**
 * Editor gallery strip (#591, `designs/gift-gallery/refined.html`): 68 px tiles (60 px on narrow
 * screens) that wrap on desktop and scroll in one row on mobile. The list insets leave room for
 * the selected tile's ring and the corner controls' shadows.
 */
export const giftImageStripVariants = tv({
	slots: {
		root: 'flex min-w-0 flex-col gap-1.5',
		heading: 'flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1',
		headingTitle: 'text-[0.8125rem] font-semibold',
		headingHint: 'text-xs text-muted-foreground',
		list: 'm-0 flex list-none flex-nowrap gap-3 overflow-x-auto p-[0.4375rem] pe-[calc(0.4375rem+var(--elevation-compact-offset))] pb-[calc(0.625rem+var(--elevation-compact-offset))] [scrollbar-width:thin] sm:flex-wrap sm:overflow-x-visible sm:pb-[calc(0.4375rem+var(--elevation-compact-offset))]',
		tile: 'group/tile relative size-15 shrink-0 sm:size-17',
		select: [
			'block size-full cursor-pointer overflow-hidden rounded-[0.625rem] border-2 border-ink-faint bg-surface p-0 outline-none hover:border-ink',
			'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-disabled:cursor-not-allowed',
			'group-data-selected/tile:border-(length:--border-w) group-data-selected/tile:border-ink group-data-selected/tile:ring-[2.5px] group-data-selected/tile:ring-brand group-data-selected/tile:ring-offset-[3px] group-data-selected/tile:ring-offset-card',
		],
		emptySource:
			'flex size-full items-center justify-center text-muted-foreground [&_svg]:size-5',
		// 22 px controls keep the tile centre free for selecting; a pseudo-element pads each hit area to 24 px.
		cornerControl:
			'absolute top-[3px] z-1 size-5.5 rounded-md before:absolute before:-inset-px before:content-[""] [&_svg]:size-3',
		grip: 'start-[3px] cursor-grab touch-none active:cursor-grabbing aria-disabled:opacity-45',
		// Remove shows, and takes presses, only on the selected, hovered or focused tile: a hidden
		// control must not catch a tap meant to select, and touch users remove after selecting.
		remove: [
			'pointer-events-none end-[3px] opacity-0 transition-opacity duration-(--duration-normal)',
			'group-focus-within/tile:pointer-events-auto group-focus-within/tile:opacity-100 group-hover/tile:pointer-events-auto group-hover/tile:opacity-100 group-data-selected/tile:pointer-events-auto group-data-selected/tile:opacity-100',
			// Dimmed only where it is visible, so a hidden remove stays hidden while the strip is locked.
			'group-focus-within/tile:aria-disabled:opacity-45! group-hover/tile:aria-disabled:opacity-45! group-data-selected/tile:aria-disabled:opacity-45!',
		],
		cover: 'pointer-events-none absolute inset-x-1 bottom-1 truncate rounded-full bg-primary px-1 text-center text-[0.625rem] leading-[1.0625rem] font-extrabold text-primary-foreground',
		pendingTile:
			'flex size-15 shrink-0 items-center justify-center rounded-[0.625rem] border-2 border-dashed border-ink bg-surface text-muted-foreground sm:size-17',
		addTile: [
			'flex size-15 shrink-0 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-[0.625rem] border-2 border-dashed border-ink bg-card p-0 text-[0.6875rem] font-bold sm:size-17 [&_svg]:size-4.5',
			'outline-none hover:bg-panel-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-disabled:cursor-not-allowed aria-disabled:opacity-45 aria-disabled:hover:bg-card',
		],
		limitNote: 'text-xs font-semibold text-foreground',
	},
});
