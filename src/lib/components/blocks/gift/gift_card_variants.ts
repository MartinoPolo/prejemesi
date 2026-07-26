import { tv } from 'tailwind-variants';

/**
 * Anime-sky sticker gift card (issue #102 REQ-14): ink border, hard offset
 * shadow, spring lift on hover, dotted-mat image background that brightens on
 * hover. `dimmed` covers fully reserved (visitor/moderator view) and received
 * gifts — the card greys out, stops lifting, and the mat stops brightening; the
 * reservation sticker stays crisp on top.
 *
 * The card is a row subgrid spanning 7 tracks (image / name / price / priority
 * / links / description / footer) of the grid in WishlistGiftCardGrid, so the
 * same sections sit on shared rows across every card in a grid row; a card
 * missing a section leaves an aligned blank slot. Sections carry explicit
 * row-start values — without them auto-placement would compact absent sections
 * away. Vertical rhythm comes from item margins (not row gaps) so fully-empty
 * tracks collapse.
 */
export const giftCardVariants = tv({
	slots: {
		card: 'group relative row-span-7 grid grid-rows-subgrid overflow-hidden rounded-panel border-[2.5px] border-ink bg-card shadow-sticker transition-[transform,box-shadow] duration-200 ease-spring hover:shadow-sticker-lift focus-within:shadow-sticker-lift motion-safe:hover:-translate-y-1 motion-safe:focus-within:-translate-y-1',
		// 4:3 (issue #183, revises the earlier 1:1 shape): shorter cards, same
		// `minmax(280px, 1fr)` grid column sizing.
		imageArea:
			'relative isolate row-start-1 aspect-[4/3] w-full overflow-hidden border-b-[2.5px] border-ink bg-surface',
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
		body: 'row-span-5 row-start-2 grid grid-rows-subgrid p-4',
		nameRow: 'row-start-1 flex flex-wrap items-baseline gap-1.5',
		name: 'line-clamp-2 font-heading text-[17px] font-semibold leading-snug text-foreground',
		price: 'row-start-2 mt-2 text-[15px] font-bold text-foreground',
		priceEmpty: 'row-start-2 mt-2 text-sm text-muted-foreground italic',
		priorityEyebrow: 'row-start-3 mt-2 flex items-center gap-1',
		linkList: 'row-start-4 mt-2 flex flex-col',
		// min-w-0: grid items (unlike flex) get an automatic min-content floor that can force the row wider (#211).
		footer: 'row-start-7 flex min-w-0 items-center justify-between gap-2 px-4 pt-1 pb-3.5',
		// Stacks mark-as-bought + cancel vertically; shrink-to-fit column, buttons get `w-full` from the caller (#211).
		reservationActions: 'flex flex-col gap-1.5',
		reservedSticker:
			'absolute inset-0 z-10 m-auto flex h-fit w-fit max-w-[85%] -rotate-6 flex-col items-center rounded-[10px] border-[2.5px] border-ink bg-card px-3.5 py-1.5 text-sm font-extrabold text-foreground shadow-sticker',
		reservedStickerLabel: 'flex items-center gap-1',
		/** Who reserved, e.g. „rezervoval(a) Babička" — moderators only (issue #198). */
		reservedStickerNames: 'max-w-full truncate text-[11px] font-semibold text-muted-foreground',
		// Bottom-right + opposite tilt (issue #184): the top-right corner is the edit
		// affordance's territory for editing roles; keep both simultaneously visible.
		receivedSticker:
			'absolute right-2.5 bottom-2.5 z-10 flex -rotate-4 items-center gap-1 rounded-full border-2 border-ink bg-primary px-2.5 py-0.5 text-[11.5px] font-extrabold text-primary-foreground',
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
