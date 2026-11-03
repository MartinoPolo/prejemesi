import { tv } from 'tailwind-variants';
import type { HTMLOlAttributes } from 'svelte/elements';

export const stepperVariants = tv({
	slots: {
		root: 'flex items-center gap-2',
		connector: 'relative min-w-3 flex-1 border-t-2 border-dashed border-ink-faint',
		/** Solid ink over the dashed track; its `transform` lets a host animate the progress. */
		connectorFill: 'absolute inset-x-0 -top-0.5 origin-left border-t-2 border-ink',
		step: 'flex items-center gap-1.5 whitespace-nowrap text-(length:--text-sm)',
		marker: 'flex size-6 items-center justify-center rounded-full border-2 text-xs font-bold',
		label: '',
	},
	variants: {
		progress: {
			upcoming: {
				step: 'font-semibold text-muted-foreground',
				marker: 'border-ink-faint bg-surface text-muted-foreground',
				// Narrow phones keep only the current step's label so every step fits on one line.
				label: 'max-[400px]:hidden',
			},
			current: {
				step: 'font-bold text-foreground',
				marker: 'border-ink bg-primary text-primary-foreground',
			},
			completed: {
				step: 'font-semibold text-muted-foreground',
				marker: 'border-ink bg-primary text-primary-foreground',
				label: 'max-[400px]:hidden',
			},
		},
	},
});

export type StepProgress = keyof typeof stepperVariants.variants.progress;

export function stepProgress(stepIndex: number, currentStepIndex: number): StepProgress {
	if (stepIndex < currentStepIndex) {
		return 'completed';
	}
	return stepIndex === currentStepIndex ? 'current' : 'upcoming';
}

/** Extra attributes such as `data-testid` land on the step list; its look stays fixed. */
export interface StepperProps extends Omit<
	HTMLOlAttributes,
	'children' | 'class' | 'style' | 'aria-label'
> {
	/** Visible step names, in order. */
	stepLabels: readonly string[];
	/** Zero-based index of the step the user is on. */
	currentStepIndex: number;
	/** Accessible name of the step list. */
	label: string;
	ref?: HTMLOListElement | null;
}
