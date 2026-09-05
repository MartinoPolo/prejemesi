import { tv } from 'tailwind-variants';

export const depthStyleSwitcherVariants = tv({
	slots: {
		root: 'flex flex-col gap-1.5',
		label: 'text-(length:--text-sm) font-semibold text-muted-foreground',
		choices: 'grid grid-cols-3 gap-2 pr-1 pb-1',
		choice: 'elevation-interactive relative min-h-12 min-w-0 justify-center rounded-btn border-2 border-border-strong bg-card px-1.5 text-center text-(length:--text-xs) font-bold text-foreground whitespace-nowrap data-[state=on]:border-border-strong data-[state=on]:bg-[var(--selection-tint)] data-[state=on]:text-foreground',
		indicator:
			'absolute top-0.5 right-0.5 grid size-3.5 place-items-center rounded-full border-2 border-ink after:size-1.5 after:rounded-full data-[selected=true]:after:bg-ink',
	},
	variants: {
		synchronized: {
			false: { choices: 'invisible' },
		},
	},
});
