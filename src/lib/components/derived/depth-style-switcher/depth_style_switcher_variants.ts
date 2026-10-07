import { tv } from 'tailwind-variants';

export const depthStyleSwitcherVariants = tv({
	slots: {
		root: 'flex flex-col gap-1.5',
		label: 'text-(length:--text-sm) font-semibold text-muted-foreground',
		// Each option previews its own depth's shadow, so clearance is fixed rather than --nested-control-gap.
		choices:
			'grid grid-cols-3 gap-[calc(0.5rem+var(--elevation-ordinary-offset))] pr-(--elevation-ordinary-offset) pb-(--elevation-ordinary-offset)',
		choice: 'min-h-12 min-w-0',
		choiceSurface: 'px-1.5 text-center text-(length:--text-xs) font-bold',
	},
	variants: {
		synchronized: {
			false: { choices: 'invisible' },
		},
	},
});
