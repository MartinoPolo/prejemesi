import type { Snippet } from 'svelte';
import type { WithElementRef } from '$lib/utils.js';
import type { HTMLAttributes } from 'svelte/elements';
import { tv } from 'tailwind-variants';

export const cardVariants = tv({
	base: 'relative flex flex-col gap-6 bg-card text-card-foreground border-[2.5px] border-ink rounded-panel py-6 shadow-sticker transition-[transform,box-shadow] ease-spring',
	variants: {
		padding: {
			none: '',
			padded: 'p-4',
		},
		state: {
			default: '',
			hover: '-translate-y-1 shadow-sticker-lift',
			selected: 'border-primary',
			focus: 'outline-2 outline-solid outline-offset-2 outline-ring',
			dragging: '-rotate-1 scale-[1.02] shadow-sticker-lift cursor-grabbing opacity-[0.92]',
			loading: 'relative overflow-hidden',
			error: 'border-status-danger',
			success: 'border-status-success',
			archived: 'opacity-55',
			disabled: 'opacity-45 pointer-events-none',
		},
	},
	defaultVariants: {
		padding: 'none',
		state: 'default',
	},
});

export type CardPadding = keyof typeof cardVariants.variants.padding;
export type CardState = keyof typeof cardVariants.variants.state;

export const CARD_PADDING_OPTIONS = Object.keys(cardVariants.variants.padding) as CardPadding[];
export const CARD_STATE_OPTIONS = Object.keys(cardVariants.variants.state) as CardState[];

export type CardProps = WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {
	padding?: CardPadding;
	state?: CardState;
	accentBarColor?: string;
	children?: Snippet;
};
