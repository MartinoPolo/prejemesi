import { tv } from 'tailwind-variants';
import { RESPONSIVE_CONTROL_SIZE_CLASSES } from '$lib/components/base/control_sizing.js';

/**
 * Gift editor links (#706, `designs/gift-editor-rebuild/refined.html`): one line per link inside a
 * bordered list, control-height rows (40 px on phones, 32 px from `sm`), an inline panel for the
 * expanded link and the paste field as the last row. The grip and paste-icon columns share one
 * width so the addresses and the paste text line up.
 */
export const giftLinkEditorVariants = tv({
	slots: {
		root: 'flex min-w-0 flex-col gap-2',
		heading: 'flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1',
		counter: 'text-xs text-muted-foreground',
		box: 'overflow-hidden rounded-btn border-[2.5px] border-edge-control bg-card',
		list: 'm-0 list-none p-0',
		row: 'border-b border-border data-expanded:bg-[color-mix(in_oklab,var(--primary)_5%,var(--card))]',
		line: `flex items-center transition-colors duration-(--duration-fast) hover:bg-panel-hover ${RESPONSIVE_CONTROL_SIZE_CLASSES}`,
		leadingColumn:
			'flex h-full w-10 shrink-0 items-center justify-center text-muted-foreground sm:w-6 [&_svg]:size-3.5',
		grip: 'cursor-grab touch-none outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring active:cursor-grabbing aria-disabled:cursor-not-allowed aria-disabled:opacity-45',
		toggle: [
			'group/toggle flex h-full min-w-0 flex-1 cursor-pointer items-center gap-1 ps-1 text-start outline-none',
			'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-70',
		],
		chip: 'max-w-[45%] shrink-0 truncate rounded-full bg-primary-soft px-1.75 py-0.5 text-(length:--text-sm) font-bold text-foreground',
		address:
			'min-w-0 flex-1 truncate text-(length:--text-base) text-muted-foreground data-invalid:text-status-danger-text sm:text-(length:--text-md)',
		highlight: 'rounded-[4px] bg-primary-soft px-[3px] py-px font-bold text-foreground',
		editIcon: [
			'grid size-(--size-control-lg) shrink-0 place-items-center rounded-btn text-muted-foreground sm:size-(--size-control-sm) [&_svg]:size-3.5',
			'transition-[color,background-color,scale] duration-(--duration-fast) group-hover/toggle:bg-accent group-hover/toggle:text-foreground motion-safe:group-active/toggle:scale-(--press-scale)',
		],
		// Enters by fading (and nudging down unless motion is reduced); the row grows without animating its height.
		panel: [
			'grid gap-2 px-3 pb-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end sm:pe-2.5 sm:pb-1.5 sm:ps-7',
			'transition-[opacity,translate] duration-(--duration-normal) ease-(--ease-standard) starting:opacity-0 motion-safe:starting:-translate-y-1',
		],
		field: 'flex min-w-0 flex-col gap-1.5 sm:gap-1',
		fieldHeading: 'flex items-baseline justify-between gap-2',
		fieldAside: 'truncate text-xs text-muted-foreground max-sm:hidden',
		labelAndRemove: 'grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 sm:contents',
		rowError: 'px-3 pb-2 sm:ps-7',
		paste: `flex items-center focus-within:shadow-[inset_0_0_0_2px_var(--ring)] has-disabled:opacity-70 ${RESPONSIVE_CONTROL_SIZE_CLASSES}`,
		pasteInput:
			'h-full min-w-0 flex-1 border-0 bg-transparent p-0 ps-1 text-(length:--text-base) font-medium text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed sm:text-(length:--text-md)',
		pasteShortcut: 'me-1.5 max-sm:hidden',
	},
});
