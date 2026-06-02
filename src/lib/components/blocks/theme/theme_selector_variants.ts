import { tv } from 'tailwind-variants';

export const themeSelectorVariants = tv({
	slots: {
		root: 'flex flex-col gap-4',
		presetGrid: 'grid grid-cols-2 gap-3 sm:grid-cols-3',
		customSection: 'flex flex-col gap-3 rounded-lg border border-border p-4',
		customLabel: 'text-sm font-medium text-foreground',
		customInputRow: 'flex items-center gap-3',
		colorInput:
			'size-10 cursor-pointer rounded-lg border border-border p-0.5 transition-shadow hover:shadow-md',
		colorPreview: 'flex-1 rounded-md px-3 py-1.5 text-sm font-mono text-muted-foreground',
		footer: 'flex items-center justify-end gap-2 border-t border-border pt-4',
	},
});

export const themePresetCardVariants = tv({
	slots: {
		root: 'group relative flex cursor-pointer flex-col gap-2 rounded-xl border-2 bg-transparent p-3 text-left outline-none transition-all hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.97]',
		swatchRow: 'flex h-8 overflow-hidden rounded-lg',
		swatch: 'flex-1',
		labelRow: 'flex items-center gap-1.5',
		emoji: 'text-base',
		label: 'text-sm font-medium text-foreground',
		checkmark:
			'absolute top-2 right-2 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground',
	},
	variants: {
		selected: {
			true: {
				root: 'border-primary shadow-sm',
			},
			false: {
				root: 'border-border hover:border-primary/40',
			},
		},
	},
	defaultVariants: {
		selected: false,
	},
});
