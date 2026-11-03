import { tv } from 'tailwind-variants';

export const segmentedToggleVariants = tv({
	slots: {
		surface: 'border-0 bg-transparent group-data-[state=on]:bg-transparent',
		root: 'w-fit gap-px overflow-visible rounded-btn bg-accent p-px shadow-none',
		/** Items keep the Button owner's `rounded-btn` corners. */
		item: 'h-full border-0 bg-transparent shadow-none focus-visible:!outline-offset-2 focus-visible:!outline-ring data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:outline-2 data-[state=on]:outline-solid data-[state=on]:outline-offset-[-2px] data-[state=on]:outline-ink',
		/** Paints the selected face that slides between items; mirrors the selected item face. */
		indicator: 'rounded-btn bg-card',
	},
	variants: {
		presentation: {
			default: {
				indicator: 'outline-2 outline-offset-[-2px] outline-ink outline-solid',
			},
			connected: {
				root: "segmented-toggle-connected relative isolate bg-transparent before:pointer-events-none before:absolute before:inset-0 before:z-0 before:rounded-btn before:bg-accent before:shadow-elevation-ordinary before:content-['']",
				indicator: 'border-(length:--border-w) border-solid border-ink',
			},
		},
		width: {
			/** The tray hugs its options. */
			hug: {},
			/**
			 * Equal-width options filling a narrow container, such as a sheet footer; compact
			 * text keeps several labelled options on one row of a phone-width tray.
			 */
			fill: {
				root: 'w-full',
				item: 'min-w-0 flex-1',
				surface: 'min-w-0 px-1.5 text-(length:--text-xs)',
			},
		},
	},
	defaultVariants: {
		presentation: 'default',
		width: 'hug',
	},
});

/** Lets items follow their tray's `width` without repeating it on every item. */
export const SEGMENTED_TOGGLE_WIDTH_CONTEXT = Symbol('segmented-toggle-width');

export type SegmentedTogglePresentation =
	keyof typeof segmentedToggleVariants.variants.presentation;
export const SEGMENTED_TOGGLE_PRESENTATIONS = Object.keys(
	segmentedToggleVariants.variants.presentation,
) as SegmentedTogglePresentation[];
export type SegmentedToggleWidth = keyof typeof segmentedToggleVariants.variants.width;
export const SEGMENTED_TOGGLE_WIDTHS = Object.keys(
	segmentedToggleVariants.variants.width,
) as SegmentedToggleWidth[];
