import type { Snippet } from 'svelte';
import type { WithElementRef } from '$lib/utils.js';
import type { HTMLAttributes } from 'svelte/elements';
import { tv } from 'tailwind-variants';

export const cardVariants = tv({
	base: 'elevation-ordinary relative flex flex-col gap-6 bg-card text-card-foreground border-[2.5px] border-ink rounded-panel py-6 transition-[translate,scale,box-shadow] duration-(--duration-normal) ease-(--ease-standard) delay-0 motion-reduce:transition-none motion-reduce:translate-y-0 motion-reduce:scale-100 motion-reduce:rotate-0',
	variants: {
		padding: {
			none: '',
			padded: 'p-4',
		},
		state: {
			default: '',
			hover: '-translate-y-1 elevation-lifted',
			selected: 'border-primary',
			focus: 'outline-2 outline-solid outline-offset-2 outline-ring',
			dragging: '-rotate-1 scale-[1.02] elevation-lifted cursor-grabbing opacity-[0.92]',
			loading: 'relative overflow-hidden',
			error: 'border-status-danger',
			success: 'border-status-success',
			archived: 'opacity-55',
			disabled: 'elevation-flat opacity-45 pointer-events-none',
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
