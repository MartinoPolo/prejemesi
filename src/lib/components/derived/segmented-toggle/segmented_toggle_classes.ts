import { tv } from 'tailwind-variants';

export const segmentedToggleVariants = tv({
	slots: {
		surface: '',
		root: 'w-fit gap-px overflow-visible rounded-btn bg-accent p-px shadow-none',
		item: '',
		/** Paints the selected face that slides between items; mirrors the selected item face. */
		indicator: 'rounded-btn bg-card',
	},
	variants: {
		presentation: {
			default: {
				indicator: 'outline-2 outline-offset-[-2px] outline-edge outline-solid',
			},
			connected: {
				root: "segmented-toggle-connected relative isolate bg-transparent before:pointer-events-none before:absolute before:inset-0 before:z-0 before:rounded-btn before:bg-accent before:shadow-elevation-ordinary before:content-['']",
				indicator: 'border-(length:--border-w) border-solid border-edge',
			},
			/**
			 * A bar of equal options that switches between panels, such as a sheet's sections: no tray,
			 * the selected option gets the accent face with an edge outline.
			 */
			'tab-bar': {
				root: 'gap-1 bg-transparent p-0',
				indicator: 'bg-accent outline-2 outline-offset-[-2px] outline-edge outline-solid',
			},
			/**
			 * Equal-weight choices that each stand on their own, such as who a new wishlist is for:
			 * separate outline buttons with the selected one filled primary, no tray and no sliding face.
			 */
			cards: {
				root: 'gap-2 bg-transparent p-0',
			},
		},
		width: {
			/** The tray hugs its options. */
			hug: {},
			/** Equal-width options filling their container. */
			fill: {
				root: 'w-full',
				item: 'min-w-0 flex-1',
				surface: 'min-w-0',
			},
		},
	},
	compoundVariants: [
		{
			presentation: ['default', 'connected', 'tab-bar'],
			class: {
				surface: 'border-0 bg-transparent group-data-[state=on]:bg-transparent',
				/** Items keep the Button owner's `rounded-btn` corners. */
				item: 'h-full border-0 bg-transparent shadow-none focus-visible:!outline-offset-2 focus-visible:!outline-ring data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:outline-2 data-[state=on]:outline-solid data-[state=on]:outline-offset-[-2px] data-[state=on]:outline-edge',
			},
		},
		{ presentation: 'tab-bar', class: { item: 'data-[state=on]:bg-accent' } },
	],
	defaultVariants: {
		presentation: 'default',
		width: 'hug',
	},
});

/** Lets items follow their tray's `presentation` and `width` without repeating them on every item. */
export const SEGMENTED_TOGGLE_CONTEXT = Symbol('segmented-toggle');

export type SegmentedTogglePresentation =
	keyof typeof segmentedToggleVariants.variants.presentation;

export interface SegmentedToggleContext {
	presentation: SegmentedTogglePresentation;
	width: SegmentedToggleWidth;
}
export const SEGMENTED_TOGGLE_PRESENTATIONS = Object.keys(
	segmentedToggleVariants.variants.presentation,
) as SegmentedTogglePresentation[];
export type SegmentedToggleWidth = keyof typeof segmentedToggleVariants.variants.width;
export const SEGMENTED_TOGGLE_WIDTHS = Object.keys(
	segmentedToggleVariants.variants.width,
) as SegmentedToggleWidth[];
