import { tv } from 'tailwind-variants';

/** One choice in a proposal review: accept, reject, a destructive yes, or opening the field editor. */
export const decisionToggleVariants = tv({
	slots: {
		root: [
			'inline-flex cursor-pointer items-center justify-center rounded-btn border-2 border-edge bg-card text-ink [&_svg]:size-4',
			'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid',
			'disabled:cursor-not-allowed disabled:opacity-40',
			// Hover only paints a resting choice, so an active choice keeps its fill under the pointer.
			'enabled:not-aria-pressed:not-aria-[pressed=mixed]:not-aria-expanded:hover:bg-panel-hover',
		],
		label: '',
	},
	variants: {
		format: {
			/** A square icon button; the label is its accessible name. */
			icon: { root: 'size-(--size-control-sm) p-0' },
			/** Icon and visible label, at the touch size on phones. */
			text: {
				root: 'h-(--size-control-lg) min-w-(--size-control-lg) gap-1.5 px-2.5 text-(length:--text-sm) leading-none font-semibold whitespace-nowrap sm:h-(--size-control-sm) sm:min-w-(--size-control-sm)',
			},
		},
		tone: {
			accept: {
				root: 'aria-pressed:border-status-success-text aria-pressed:bg-status-success-text aria-pressed:text-card aria-[pressed=mixed]:border-dashed aria-[pressed=mixed]:bg-[color-mix(in_oklab,var(--status-success)_14%,var(--card))]',
			},
			reject: {
				root: 'aria-pressed:bg-ink aria-pressed:text-card aria-[pressed=mixed]:border-dashed aria-[pressed=mixed]:bg-muted',
			},
			/** A yes that destroys something, such as deleting the gift. */
			danger: {
				root: 'aria-pressed:border-status-danger-text aria-pressed:bg-status-danger-text aria-pressed:text-card',
			},
			/** Opens the field editor; active while it is expanded. */
			edit: { root: 'aria-expanded:bg-primary aria-expanded:text-primary-foreground' },
		},
		/** Phones show only the icon, for a row of choices too wide for their labels. */
		compactOnPhone: {
			true: { label: 'max-sm:sr-only' },
			false: {},
		},
	},
	defaultVariants: {
		format: 'text',
		compactOnPhone: false,
	},
});

export type DecisionToggleFormat = keyof typeof decisionToggleVariants.variants.format;
export type DecisionToggleTone = keyof typeof decisionToggleVariants.variants.tone;

export const DECISION_TOGGLE_FORMATS = Object.keys(
	decisionToggleVariants.variants.format,
) as DecisionToggleFormat[];
export const DECISION_TOGGLE_TONES = Object.keys(
	decisionToggleVariants.variants.tone,
) as DecisionToggleTone[];
