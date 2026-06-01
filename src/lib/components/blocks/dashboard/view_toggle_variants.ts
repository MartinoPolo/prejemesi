import { tv } from 'tailwind-variants';

export const viewToggleVariants = tv({
	slots: {
		root: 'flex items-center overflow-hidden rounded-md border border-border bg-card',
		button: 'flex size-9 items-center justify-center border-none bg-transparent text-muted-foreground transition-colors duration-normal',
	},
	variants: {
		active: {
			true: {
				button: 'bg-primary/10 text-primary',
			},
			false: {
				button: 'hover:bg-accent hover:text-foreground',
			},
		},
	},
});
