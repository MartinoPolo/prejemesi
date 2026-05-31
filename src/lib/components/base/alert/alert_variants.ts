import type { Snippet } from 'svelte';
import { tv } from 'tailwind-variants';
import type { HTMLAttributes } from 'svelte/elements';
import type { WithElementRef } from '$lib/utils.js';

export const alertVariants = tv({
	base: "grid gap-0.5 rounded-lg border px-4 py-3 text-left text-sm has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2.5 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4 group/alert relative w-full",
	variants: {
		tone: {
			default: 'bg-card text-card-foreground',
			destructive:
				'text-destructive bg-card *:data-[slot=alert-description]:text-destructive/90 *:[svg]:text-current',
			warning:
				'text-status-warning bg-card *:data-[slot=alert-description]:text-status-warning/90 *:[svg]:text-current',
		},
	},
	defaultVariants: {
		tone: 'default',
	},
});

export type AlertTone = keyof typeof alertVariants.variants.tone;

export const ALERT_TONES = Object.keys(alertVariants.variants.tone) as AlertTone[];

export type AlertProps = WithElementRef<HTMLAttributes<HTMLDivElement>> & {
	tone?: AlertTone;
	children?: Snippet;
};
