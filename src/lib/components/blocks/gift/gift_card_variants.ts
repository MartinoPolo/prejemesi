import { tv } from 'tailwind-variants';

/**
 * Anime-sky sticker gift card (issue #102 REQ-14): ink border, hard offset
 * shadow, spring lift on hover, dotted-mat image background that brightens on
 * hover. `dimmed` covers fully reserved (visitor/moderator view) and received
 * gifts — the card greys out, stops lifting, and the mat stops brightening; the
 * reservation sticker stays crisp on top.
 */
export const giftCardVariants = tv({
	slots: {
		card: 'group relative flex h-full flex-col overflow-hidden rounded-panel border-[2.5px] border-ink bg-card shadow-sticker transition-[transform,box-shadow] duration-200 ease-spring hover:shadow-sticker-lift focus-within:shadow-sticker-lift motion-safe:hover:-translate-y-1 motion-safe:focus-within:-translate-y-1',
		imageArea:
			'relative isolate aspect-square w-full overflow-hidden border-b-[2.5px] border-ink bg-surface',
		/**
		 * Dotted mat behind the photo (shows through letterboxed photos). Sits on
		 * its own layer below the image so its opacity can fade up on hover —
		 * replaces the earlier diagonal position pan, which read as distracting on
		 * top of the card's lift.
		 */
		imagePattern:
			'pointer-events-none absolute inset-0 -z-[1] bg-[radial-gradient(var(--pattern-dot)_1.4px,transparent_1.5px)] bg-size-[18px_18px] opacity-60 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100',
		/** Grey veil over the image of a dimmed card ("don't buy this" at first glance). */
		imageVeil: 'absolute inset-0 bg-reserved-veil',
		body: 'flex flex-1 flex-col gap-2 p-4',
		nameRow: 'flex flex-wrap items-baseline gap-1.5',
		name: 'line-clamp-2 font-heading text-[17px] font-semibold leading-snug text-foreground',
		price: 'text-[15px] font-bold text-foreground',
		priceEmpty: 'text-sm text-ink-soft italic',
		priorityEyebrow: 'flex items-center gap-1',
		linkList: 'flex flex-col',
		footer: 'flex items-center justify-between gap-2 px-4 pt-1 pb-3.5',
		reservedSticker:
			'absolute inset-0 z-10 m-auto flex h-fit w-fit max-w-[85%] -rotate-6 flex-col items-center rounded-[10px] border-[2.5px] border-ink bg-card px-3.5 py-1.5 text-sm font-extrabold text-foreground shadow-sticker',
		reservedStickerLabel: 'flex items-center gap-1',
		/** Who reserved, e.g. „rezervoval(a) Babička" (issue #102 REQ-14) — visitors/moderators only. */
		reservedStickerNames: 'max-w-full truncate text-[11px] font-semibold text-ink-soft',
		receivedSticker:
			'absolute top-2.5 right-2.5 z-10 flex rotate-4 items-center gap-1 rounded-full border-2 border-ink bg-primary px-2.5 py-0.5 text-[11.5px] font-extrabold text-primary-foreground',
		/** Edit-icon hover affordance for managers (issue #125 REQ-3): hidden until card hover/focus. */
		editIcon:
			'absolute top-2.5 right-2.5 z-10 flex items-center justify-center rounded-full border-2 border-ink bg-card p-1.5 opacity-0 shadow-sticker transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100',
	},
	variants: {
		dimmed: {
			true: {
				card: 'bg-[color-mix(in_oklab,var(--card)_82%,var(--surface))] hover:shadow-sticker-strong focus-within:shadow-sticker-strong motion-safe:hover:translate-y-0 motion-safe:focus-within:translate-y-0',
				imagePattern: 'group-hover:opacity-60 group-focus-within:opacity-60',
				body: 'opacity-55 grayscale-50',
				footer: 'opacity-55 grayscale-50',
			},
			false: {},
		},
	},
	defaultVariants: {
		dimmed: false,
	},
});
