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

		// ── Read-only view mode (issue #165) ──────────────────────────────────
		// Dedicated slots instead of reusing the edit-mode `body`/`imageColumn`/
		// `detailColumn` above: the view reads as an enlarged gift card (tighter,
		// no `sm:min-h-[520px]` dead space), so its own composition rules apply
		// without risking the edit-mode grid used by #116/#131/#142.
		// Mobile: one scrolling flex column (media, content, sticky action bar).
		// Desktop: 340px media column + fluid content column sharing row 1;
		// the action bar is the grid's `auto` row, spanning both columns, pinned
		// outside the content column's own scroll region (REQ-1).
		viewGrid:
			'flex min-h-0 flex-1 flex-col overflow-y-auto sm:grid sm:grid-cols-[340px_minmax(0,1fr)] sm:grid-rows-[minmax(0,1fr)_auto] sm:flex-initial sm:overflow-hidden',
		// shrink-0: prevents the mobile flex column from compressing the media area
		// (same rationale as `imageColumn`). The mobile height clamp keeps the title
		// + facts + action bar reachable without scrolling past a tall square photo
		// (REQ-5); desktop fills the grid's row 1 at its natural 340px column width.
		viewMedia:
			'relative flex shrink-0 max-h-[42vh] min-h-[240px] items-center justify-center overflow-hidden border-b-2 border-dashed border-ink-faint bg-surface bg-[radial-gradient(var(--pattern-dot)_1.4px,transparent_1.5px)] bg-size-[18px_18px] p-4 sm:max-h-none sm:min-h-0 sm:border-r-2 sm:border-b-0 sm:p-6',
		// Positioned ancestor for the photo-overlay stack; width-capped so the mat
		// can stretch (REQ-5) while the square photo inside stays a fixed, honest size.
		viewPhotoFrame: 'relative w-full max-w-[260px]',
		// Physical photo sticker (matches the `.polaroid` treatment in WishlistHeader):
		// fixed paper/ink colors that intentionally do NOT follow the palette or dark mode.
		viewPhoto:
			'aspect-square w-full -rotate-2 rounded-[10px] border-2 border-[#4A443A] bg-[#FFFDF6] p-[9px] shadow-[5px_6px_0_var(--hard-shadow-strong)]',
		viewPhotoInner:
			'size-full overflow-hidden rounded-[6px] border-2 border-black/10 bg-[#F2F0EA]',
		viewContent: 'flex min-h-0 flex-col sm:overflow-hidden',
		// Desktop-only internal scroll region (REQ-1 long-description strategy); mobile
		// flows into the outer `viewGrid` scroll behind the sticky action bar.
		viewContentScroll: 'flex flex-col gap-3 p-4 sm:min-h-0 sm:flex-1 sm:overflow-y-auto sm:p-6',
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
		// Fully-reserved-by-others dimming (REQ-3): applied to the photo and content
		// separately so the crisp photo-overlay status note (a sibling, not a child of
		// either) is never capped by an ancestor's reduced opacity. Matches the
		// `giftCardVariants` dimmed treatment (issue #102).
		viewDimmed: {
			true: {
				viewPhoto: 'opacity-55 grayscale-50',
				viewContentScroll: 'opacity-55 grayscale-50',
			},
			false: {},
		},
	},
	defaultVariants: {
		imageTabActive: false,
		viewDimmed: false,
	},
});

export type GiftDetailModalMode = 'create' | 'edit';
