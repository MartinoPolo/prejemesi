import type { Snippet } from 'svelte';
import type { WithElementRef } from '$lib/utils.js';
import type { HTMLAttributes } from 'svelte/elements';
import { tv } from 'tailwind-variants';

export const kbdVariants = tv({
	base: 'inline-flex h-4.5 min-w-4.5 items-center justify-center gap-px rounded-md border px-1.25 text-[10.5px] leading-none font-medium [&_svg:not([class*="size-"])]:size-3 [&_svg]:shrink-0',
	variants: {
		format: {
			default: 'font-sans',
			lucide: 'font-sans',
			mono: 'font-mono tabular-nums',
		},
		tone: {
			neutral:
				'border-border bg-muted text-foreground-muted shadow-[1px_1px_0_var(--hard-shadow)]',
			accent: 'border-[color-mix(in_oklab,var(--primary)_24%,var(--border))] bg-primary-soft text-foreground shadow-[1px_1px_0_var(--hard-shadow)]',
			inverted:
				'border-[color-mix(in_oklab,currentColor_28%,transparent)] bg-[color-mix(in_oklab,currentColor_16%,transparent)] text-current',
		},
	},
	defaultVariants: {
		format: 'default',
		tone: 'neutral',
	},
});

export type KbdFormat = keyof typeof kbdVariants.variants.format;
export type KbdTone = keyof typeof kbdVariants.variants.tone;

export const KBD_FORMATS = Object.keys(kbdVariants.variants.format) as KbdFormat[];
export const KBD_TONES = Object.keys(kbdVariants.variants.tone) as KbdTone[];

export type KbdProps = WithElementRef<HTMLAttributes<HTMLElement>, HTMLElement> & {
	format?: KbdFormat;
	tone?: KbdTone;
	children?: Snippet;
};
