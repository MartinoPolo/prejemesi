import { tv } from 'tailwind-variants';

/**
 * Anime-sky sticker gift card (issue #102 REQ-14): ink border, hard offset
 * shadow, coherent lift of the direct surface and all nested content on hover,
 * dotted-mat image background that brightens on hover. `dimmed` covers fully
 * reserved (visitor/moderator view) and received gifts: image art and body content
 * keep half visibility, the frame paint softens without changing geometry, and
 * elevation stops. Actions, image overlays, and the centered state overlay stay crisp.
 */
export const giftCardVariants = tv({
	slots: {
		// Decorative image hover belongs to the card; the wrapper's `group/gift-card` remains
		// reserved for keeping the drag grip in lock-step with card elevation.
		card: 'gift-card-root group/gift-card-decoration relative isolate rounded-panel',
		// Paint over fractional edge antialiasing without changing the surface's border box or hit targets.
		surface:
			'gift-card-painted-surface resting-shadow-nesting elevation-surface relative grid grid-rows-[auto_minmax(0,1fr)_auto] rounded-[inherit] border-[2.5px] bg-card transition-[translate,scale,box-shadow] duration-(--duration-normal) ease-(--ease-standard) after:pointer-events-none after:absolute after:inset-0 after:z-30 after:rounded-[calc(var(--radius-panel)-2.5px)] after:border',
		// 4:3 (issue #183, revises the earlier 1:1 shape): shorter cards, same
		// `minmax(280px, 1fr)` grid column sizing.
		imageArea:
			'relative isolate row-start-1 box-content aspect-[4/3] w-full overflow-hidden rounded-t-[calc(var(--radius-panel)-2.5px)] bg-surface pb-[2.5px] [height:var(--gift-card-image-track-height,auto)]',
		/**
		 * Dotted mat behind the photo (shows through letterboxed photos). Sits on
		 * its own layer below the image so its opacity can fade up on hover —
		 * replaces the earlier diagonal position pan, which read as distracting on
		 * top of the card's lift.
		 */
		imagePattern:
			'pointer-events-none absolute inset-0 -z-[1] hidden bg-[radial-gradient(var(--pattern-dot)_1.4px,transparent_1.5px)] bg-size-[18px_18px] opacity-60 transition-opacity duration-300 group-hover/gift-card-decoration:opacity-100 group-focus-within/gift-card-decoration:opacity-100 sm:block',
		cropComposition: 'aspect-[4/3] w-[calc(100%+3px)] shrink-0',
		separator: 'pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[3.5px]',
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
					'gift-frame-softened border-(--gift-frame-ink) bg-[color-mix(in_oklab,var(--card)_82%,var(--surface))] [box-shadow:var(--gift-frame-elevation)] after:border-(--gift-frame-ink) after:shadow-[0_0_0_2.5px_var(--gift-frame-ink)]',
				imagePattern:
					'group-hover/gift-card-decoration:opacity-60 group-focus-within/gift-card-decoration:opacity-60',
				cropComposition: 'opacity-50',
				separator: 'bg-(--gift-frame-ink)',
				body: 'opacity-50',
			},
			false: {
				card: 'elevation-owner elevation-owner-raised',
				surface: 'border-ink after:border-ink after:shadow-[0_0_0_2.5px_var(--ink)]',
				separator: 'bg-ink',
			},
		},
	},
	defaultVariants: {
		dimmed: false,
	},
});
