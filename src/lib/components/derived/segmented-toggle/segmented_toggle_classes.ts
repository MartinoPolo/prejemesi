import { tv } from 'tailwind-variants';

export const segmentedToggleVariants = tv({
	slots: {
		surface: 'border-0 bg-transparent group-data-[state=on]:bg-transparent',
		root: 'gap-px overflow-visible rounded-btn bg-accent p-px shadow-none',
		item: 'h-full rounded-[max(0px,calc(var(--radius-btn)-1px))] border-0 bg-transparent shadow-none focus-visible:!outline-offset-2 focus-visible:!outline-ring data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:outline-2 data-[state=on]:outline-solid data-[state=on]:outline-offset-[-2px] data-[state=on]:outline-ink',
	},
	variants: {
		presentation: {
			default: {},
			connected: {
				root: "segmented-toggle-connected relative isolate w-fit bg-transparent before:pointer-events-none before:absolute before:inset-0 before:z-0 before:rounded-btn before:bg-accent before:shadow-elevation-ordinary before:content-['']",
			},
		},
	},
	defaultVariants: {
		presentation: 'default',
	},
});

export type SegmentedTogglePresentation =
	keyof typeof segmentedToggleVariants.variants.presentation;
export const SEGMENTED_TOGGLE_PRESENTATIONS = Object.keys(
	segmentedToggleVariants.variants.presentation,
) as SegmentedTogglePresentation[];
