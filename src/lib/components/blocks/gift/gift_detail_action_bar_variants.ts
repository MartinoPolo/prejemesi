import { tv } from 'tailwind-variants';

/**
 * Gift detail modal action bar + photo-overlay reservation status (issue #165).
 * The bar is exactly two elements on one line in every state: like leftmost,
 * primary action rightmost, never any status text. Reservation status (own +
 * others') lives on the photo overlay instead — see `GiftDetailActionBar.svelte`.
 */
export const giftDetailActionBarVariants = tv({
	slots: {
		// Mobile: sticky to the bottom of the scrolling view grid, opaque so
		// content scrolls behind it, with a lift shadow. Desktop: the grid's
		// pinned `auto` row already keeps it outside the scroll region, so the
		// sticky positioning and drop shadow are dropped there.
		bar: 'sticky bottom-0 z-10 flex items-center justify-end gap-3 border-t-2 border-ink bg-card px-4 py-3 shadow-[0_-6px_18px_rgba(0,0,0,0.12)] sm:static sm:shadow-none',
		// Fills the remaining row width on mobile so the two-element bar never
		// wraps even for the longest label „Zrušit rezervaci"; desktop sizes to content.
		primary: 'flex-1 [&>*]:w-full sm:flex-none sm:[&>*]:w-auto',
		// Absolutely positioned top-left over the photo mat (never inside the
		// dimmed photo itself, so it always renders crisp).
		overlayStack: 'absolute top-2.5 left-2.5 z-10 grid justify-items-start gap-2',
		note: 'grid -rotate-3 justify-items-center gap-0.5 rounded-[10px] border-2 border-ink bg-[color-mix(in_oklab,var(--reserved)_16%,var(--card))] px-2.5 py-1.5 text-center text-[13px] leading-tight font-extrabold text-reserved shadow-sticker-sm',
		noteIcon: 'size-3.5',
		noteSub: 'text-[11px] font-semibold text-ink-soft',
		purchasedToggle: '-rotate-3 shadow-sticker-sm',
	},
});
