import { tv } from 'tailwind-variants';

/**
 * Gift detail action bar: Like in its own left section and reservation actions, including Bought,
 * grouped on the right. Reservation state lives on the photo through the shared state badges.
 */
export const giftDetailActionBarVariants = tv({
	slots: {
		// Mobile: sticky to the bottom of the scrolling view grid, opaque so
		// content scrolls behind it, with a lift shadow. Desktop: the grid's
		// pinned `auto` row already keeps it outside the scroll region, so the
		// sticky positioning and drop shadow are dropped there.
		bar: 'sticky bottom-0 z-10 flex items-center justify-end gap-(--nested-control-gap) border-t-2 border-ink bg-card px-4 py-3 shadow-[0_-6px_18px_rgba(0,0,0,0.12)] sm:static sm:shadow-none',
		// Lets the primary reservation action use available mobile width without wrapping;
		// desktop sizes it to content so a privileged release action can sit beside it.
		primary: 'flex-1 [&>*]:w-full sm:flex-none sm:[&>*]:w-auto',
	},
});
