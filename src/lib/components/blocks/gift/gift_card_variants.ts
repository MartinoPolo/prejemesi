import { tv } from 'tailwind-variants';

/**
 * Anime-sky sticker gift card (issue #102 REQ-14): ink border, hard offset
 * shadow, coherent lift of the direct surface and all nested content on hover,
 * dotted-mat image background that brightens on hover. `dimmed` covers fully
 * reserved (visitor/moderator view) and received
 * gifts — the image is veiled and elevation stops; content, actions, and the
 * centered state overlay retain their contrast.
 */
export const giftCardVariants = tv({
	slots: {
		// Decorative image hover belongs to the card; the wrapper's `group/gift-card` remains
		// reserved for keeping the drag grip in lock-step with card elevation.
		card: 'gift-card-root group/gift-card-decoration relative isolate rounded-panel',
		surface:
			'gift-card-painted-surface resting-shadow-nesting elevation-surface relative grid grid-rows-[auto_minmax(0,1fr)_auto] rounded-[inherit] border-[2.5px] border-ink bg-card transition-[translate,scale,box-shadow] duration-(--duration-normal) ease-(--ease-standard)',
		// 4:3 (issue #183, revises the earlier 1:1 shape): shorter cards, same
		// `minmax(280px, 1fr)` grid column sizing.
		imageArea:
			'relative isolate row-start-1 box-content aspect-[4/3] w-full overflow-hidden rounded-t-[calc(var(--radius-panel)-2.5px)] border-b-[2.5px] border-ink bg-surface [height:var(--gift-card-image-track-height,auto)]',
		/**
		 * Dotted mat behind the photo (shows through letterboxed photos). Sits on
		 * its own layer below the image so its opacity can fade up on hover —
		 * replaces the earlier diagonal position pan, which read as distracting on
		 * top of the card's lift.
		 */
		imagePattern:
			'pointer-events-none absolute inset-0 -z-[1] hidden bg-[radial-gradient(var(--pattern-dot)_1.4px,transparent_1.5px)] bg-size-[18px_18px] opacity-60 transition-opacity duration-300 group-hover/gift-card-decoration:opacity-100 group-focus-within/gift-card-decoration:opacity-100 sm:block',
		/** Grey veil over the image of a dimmed card ("don't buy this" at first glance). */
		imageVeil: 'absolute inset-0 bg-reserved-veil',
		body: 'row-start-2 flex min-h-0 flex-col ps-[var(--gift-content-inset,9px)] pe-[var(--gift-content-inset-end,var(--gift-content-inset,9px))] pt-2 pb-1.5 sm:py-4',
		nameRow:
			'flex min-w-0 items-start gap-1.5 [min-height:var(--gift-card-title-track-height,auto)]',
		name: 'line-clamp-2 min-w-0 flex-1 font-heading text-[1rem] font-semibold leading-[1.3] text-foreground [overflow-wrap:anywhere] sm:text-[1.5rem]',
		price: 'block text-sm font-bold text-secondary-foreground [overflow-wrap:anywhere]',
		priceEmpty: 'block text-sm text-muted-foreground italic',
		priorityEyebrow: 'mt-2 flex min-w-0 items-center gap-1',
		linkList: 'min-w-[min(9rem,100%)] max-w-full basis-auto',
		footer: 'row-start-3 flex min-w-0 items-stretch justify-between gap-[var(--gift-action-gap,0.5rem)] ps-[var(--gift-content-inset,9px)] pe-[var(--gift-content-inset-end,var(--gift-content-inset,9px))] pb-[var(--gift-content-inset-bottom,var(--gift-content-inset,9px))] [min-height:var(--gift-card-actions-track-height,auto)]',
		reservationActions:
			'ml-auto flex min-w-0 flex-1 flex-col gap-[var(--gift-action-gap,0.5rem)]',
	},
	variants: {
		dimmed: {
			true: {
				surface:
					'elevation-ordinary bg-[color-mix(in_oklab,var(--card)_82%,var(--surface))]',
				imagePattern:
					'group-hover/gift-card-decoration:opacity-60 group-focus-within/gift-card-decoration:opacity-60',
			},
			false: { card: 'elevation-owner elevation-owner-raised' },
		},
	},
	defaultVariants: {
		dimmed: false,
	},
});
