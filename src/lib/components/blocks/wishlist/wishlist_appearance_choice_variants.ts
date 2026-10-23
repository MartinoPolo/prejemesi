import { tv } from 'tailwind-variants';

/**
 * Card-shaped radio choices of the appearance editor (theme and heading-font cards). Selection is
 * a primary fill on the label strip, never an extra shadow, matching the depth-option rule.
 */
export const wishlistAppearanceChoiceVariants = tv({
	slots: {
		root: 'grid grid-cols-2 gap-3 sm:grid-cols-4',
		item: [
			'group flex min-w-0 cursor-pointer flex-col overflow-hidden rounded-[10px] border-2 border-ink bg-card text-left text-foreground shadow-(--elevation-compact) outline-none transition-colors',
			'hover:border-ring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
			'disabled:cursor-not-allowed disabled:opacity-50',
			'data-[state=checked]:border-primary',
		],
		label: [
			'flex min-h-9 flex-1 flex-col justify-center gap-0.5 px-2 py-1 text-(length:--text-xs) leading-tight font-semibold',
			'group-data-[state=checked]:bg-primary group-data-[state=checked]:text-primary-foreground',
		],
		description: [
			'font-normal text-muted-foreground',
			'group-data-[state=checked]:text-primary-foreground',
		],
	},
});
