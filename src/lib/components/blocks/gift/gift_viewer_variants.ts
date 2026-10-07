import { tv } from 'tailwind-variants';

/**
 * Gift viewer: an uncropped photo beside a scrolling caption with pinned actions on desktop, and a
 * full-screen sheet where photo and caption scroll together above a sticky footer on mobile.
 */
export const giftViewerVariants = tv({
	slots: {
		// Applied to Dialog.Content. A fit-content dialog centers with equal inline insets and auto
		// margins: with left 50% plus translate, shrink-to-fit would only see half the viewport.
		dialog: [
			'[--gift-viewer-max-height:90dvh] [--gift-viewer-max-width:1100px] [--gift-viewer-inner-max-height:calc(var(--gift-viewer-max-height)-2*var(--border-w))]',
			'[--gift-viewer-photo-height-cap:min(720px,var(--gift-viewer-inner-max-height))] [--gift-viewer-photo-min-width:280px] [--gift-viewer-caption-min-width:340px] [--gift-viewer-caption-max-width:420px]',
			'right-0 left-0 mx-auto flex max-h-(--gift-viewer-max-height) w-fit max-w-[min(var(--gift-viewer-max-width),calc(100%-2rem))] translate-x-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(var(--gift-viewer-max-width),calc(100%-2rem))]',
			'max-sm:inset-0 max-sm:h-dvh max-sm:max-h-none max-sm:w-full max-sm:max-w-none max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0 max-sm:shadow-none',
			'[--gift-viewer-mobile-close-inset:0.75rem] max-sm:[&>[data-slot=dialog-close]]:top-[calc(var(--gift-viewer-mobile-close-inset)+env(safe-area-inset-top))] max-sm:[&>[data-slot=dialog-close]]:end-(--gift-viewer-mobile-close-inset)',
		],
		root: 'resting-shadow-nesting flex min-h-0 max-w-full flex-1 flex-col',
		layout: 'flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pt-[env(safe-area-inset-top)] sm:grid sm:overflow-visible sm:pt-0',
		photoRegion:
			'relative m-0 shrink-0 border-b-(length:--border-w) border-ink sm:border-r-(length:--border-w) sm:border-b-0',
		// The column takes the photo's width at the height cap, so a tall photo leaves no side mat;
		// only a caption taller than the photo letterboxes it vertically.
		photoSizer:
			'aspect-(--photo-aspect-ratio) max-h-[55dvh] min-h-[200px] w-full sm:max-h-(--gift-viewer-photo-height-cap) sm:min-h-[400px] sm:w-[calc(var(--gift-viewer-photo-height-cap)*var(--photo-aspect-ratio))] sm:max-w-full sm:min-w-[min(var(--gift-viewer-photo-min-width),100%)]',
		photo: 'absolute inset-0 size-full rounded-none',
		// Same insets as the footer actions, so photo badges and actions share one baseline.
		photoStates:
			'absolute right-(--gift-content-inset) bottom-(--gift-content-inset-bottom) left-(--gift-content-inset) max-sm:hidden',
		captionColumn:
			'flex min-h-0 flex-col max-sm:contents sm:max-h-(--gift-viewer-inner-max-height)',
		captionScroll:
			'gift-viewer-caption-scroll min-h-0 flex-[1_0_auto] sm:flex-[1_1_auto] sm:overflow-y-auto sm:overscroll-contain',
		caption: 'grid gap-3 p-4 sm:p-6',
		// The desktop caption padding equals the standard dialog padding the close clearance assumes.
		title: 'm-0 font-heading text-[22px] leading-tight font-semibold [overflow-wrap:anywhere] text-foreground sm:pe-(--overlay-close-clearance-inside-dialog-padding) sm:text-2xl',
		priceLine:
			'-mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-muted-foreground',
		price: 'text-[17px] font-bold text-foreground',
		// The caption placement applies on mobile, and on desktop only without a photo.
		captionStates: 'sm:hidden',
		description: 'border-t-2 border-dashed border-ink-faint pt-3',
		editedLine: 'm-0 text-xs text-muted-foreground',
		footer: 'flex items-center bg-card ps-(--gift-content-inset) pe-(--gift-content-inset-end) pt-(--gift-content-inset) pb-(--gift-content-inset-bottom) max-sm:sticky max-sm:bottom-0 max-sm:z-10 max-sm:border-t-(length:--border-w) max-sm:border-ink max-sm:pb-[calc(var(--gift-content-inset-bottom)+env(safe-area-inset-bottom))]',
	},
	variants: {
		hasPhoto: {
			true: {
				// The photo keeps its minimum while the caption gives way toward its own; only when both
				// minimums cannot fit beside the dialog's outer insets and borders does the photo shrink.
				layout: 'sm:grid-cols-[minmax(min(var(--gift-viewer-photo-min-width),calc(100vw-2rem-3*var(--border-w)-var(--gift-viewer-caption-min-width))),auto)_minmax(var(--gift-viewer-caption-min-width),var(--gift-viewer-caption-max-width))]',
			},
			false: {
				root: 'sm:w-[560px]',
				captionStates: 'sm:flex',
				layout: 'sm:grid-cols-[minmax(0,1fr)]',
				caption: 'max-sm:pt-3',
				// Shares the top row with the mobile close button, inside the caption's 1rem padding.
				title: 'max-sm:min-h-10 max-sm:pt-1 max-sm:pe-[calc(var(--gift-viewer-mobile-close-inset)+var(--size-control-lg)+var(--nested-control-gap)-1rem)]',
			},
		},
		hasPrice: {
			true: {},
			false: { price: 'text-sm font-normal text-muted-foreground italic' },
		},
		hasExplicitFill: {
			true: { photoRegion: 'bg-[var(--frame-fill)]' },
			false: {
				photoRegion:
					'bg-surface bg-[radial-gradient(var(--pattern-dot)_1.4px,transparent_1.5px)] bg-size-[18px_18px]',
			},
		},
	},
	defaultVariants: {
		hasPhoto: true,
		hasPrice: true,
		hasExplicitFill: false,
	},
});
