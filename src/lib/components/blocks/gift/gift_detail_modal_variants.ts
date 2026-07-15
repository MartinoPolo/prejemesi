import { tv } from 'tailwind-variants';

export const giftDetailModalVariants = tv({
	slots: {
		// Flex column so the body inherits a definite height when the dialog is
		// capped at 90dvh – that lets the detail column pin its footer and scroll
		// only the fields (#116 follow-up, GiftDraftDialog precedent).
		content:
			'flex flex-col sm:max-w-[900px] max-h-[90dvh] overflow-hidden p-0 gap-0 max-w-[calc(100%-1rem)]',
		// Mobile: a single scrolling flex column so the image and fields share one
		// scroll region inside the 90dvh-capped dialog (issue: mobile edit dialog UX).
		// Desktop: restores the exact 2-col grid + its own overflow-hidden.
		body: 'flex min-h-0 flex-1 flex-col overflow-y-auto sm:grid sm:min-h-[520px] sm:grid-cols-[45%_55%] sm:grid-rows-[minmax(0,1fr)] sm:flex-initial sm:overflow-hidden',
		// Dotted notebook mat behind the photo (issue #102 round-2 delta): letterboxed
		// images keep the mat visible; a dashed ink seam separates image and form columns.
		// The mobile height fits the display-mode toggle + preview + tile row (#116 round 3).
		// shrink-0: `body` is a bounded-height flex column on mobile – without this, the
		// default flex-shrink:1 compresses this column below its intended height and,
		// combined with overflow-hidden, crushes/clips its content instead of letting
		// `body` scroll (mobile edit dialog UX fix).
		imageColumn:
			'relative shrink-0 overflow-hidden border-b-2 border-dashed border-ink-faint bg-surface bg-[radial-gradient(var(--pattern-dot)_1.4px,transparent_1.5px)] bg-size-[18px_18px] sm:border-b-0 sm:border-r-2 h-[260px] sm:h-auto',
		// Empty-state click-to-upload affordance (issue #131 REQ-2/REQ-3): a real
		// button so it is keyboard-focusable with a visible focus ring, not just a
		// static label.
		imagePlaceholder:
			'flex size-full cursor-pointer flex-col items-center justify-center gap-1 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
		image: 'size-full object-cover',
		// Mobile: overflow-visible so the pinned actions bar sticks to the BODY scroll
		// instead of clipping inside this column. shrink-0 (see imageColumn): keeps this
		// column at its natural content height so `body` scrolls instead of compressing
		// it – min-h-0 is kept for the sm: grid-cell scroll mechanism (harmless with
		// shrink-0 on mobile, since flex-shrink:0 makes min-height moot there).
		detailColumn: 'flex min-h-0 shrink-0 flex-col gap-0 overflow-visible sm:overflow-hidden',
		// Mobile: no own scroll region – fields flow into the body scroll. Desktop:
		// its own scroll region, unchanged.
		detailScroll: 'min-h-0 overflow-visible p-5 sm:flex-1 sm:overflow-y-auto sm:p-7',
		formField: 'flex flex-col gap-1.5',
		formLabel: 'text-sm font-medium text-foreground',
		formRow: 'grid grid-cols-2 gap-3',
		// Pinned outside the scroll region – always visible in create and edit mode.
		// Mobile: pinned to the bottom of the body scroll with an opaque bg so fields
		// scroll behind it. Desktop: sm:static – already pinned by flex in the right column.
		formActions:
			'sticky bottom-0 z-10 flex flex-col gap-2 border-t-2 border-dashed border-ink-faint bg-card px-5 py-4 sm:static sm:px-7',
		// Stacked full-width buttons cancel the shared sticker hover-lift (#142):
		// with only `gap-2` (8px) between them, the translate-based lift plus its
		// spring overshoot can exceed the hit-area buffer at the shared edge,
		// flickering lift/drop. Shadow-only hover keeps the sticker feel without
		// the geometric cause; other Button usages are unaffected.
		submitButton: 'w-full hover:translate-y-0',
		deleteButton: 'w-full',
		receivedButton: 'w-full hover:translate-y-0',
		imageInputRow: 'flex flex-col gap-2',
		imageTabRow: 'flex gap-1.5',
		imageTab:
			'cursor-pointer rounded-full border-2 px-3 py-1 text-xs font-semibold transition-colors',
	},
	variants: {
		imageTabActive: {
			true: {
				imageTab: 'border-ink bg-primary text-primary-foreground',
			},
			false: {
				imageTab:
					'border-ink bg-card text-foreground-muted hover:bg-accent hover:text-foreground',
			},
		},
	},
	defaultVariants: {
		imageTabActive: false,
	},
});

export type GiftDetailModalMode = 'create' | 'edit';
