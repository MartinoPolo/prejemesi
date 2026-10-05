import type { Snippet } from 'svelte';
import type { HTMLAnchorAttributes } from 'svelte/elements';
import type { WithElementRef } from '$lib/utils.js';
import { tv } from 'tailwind-variants';

export const textLinkVariants = tv({
	slots: {
		root: 'inline-flex max-w-full min-w-0 items-center gap-1 font-semibold text-brand-link underline decoration-1 underline-offset-2 transition-colors hover:decoration-2 focus-visible:rounded-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
		label: 'min-w-0 truncate',
		icon: 'size-[1em] shrink-0',
	},
	variants: {
		size: {
			sm: { root: 'text-(length:--text-sm)' },
			md: { root: 'text-(length:--text-base)' },
		},
	},
	defaultVariants: {
		size: 'md',
	},
});

export type TextLinkSize = keyof typeof textLinkVariants.variants.size;

export const TEXT_LINK_SIZES = Object.keys(textLinkVariants.variants.size) as TextLinkSize[];

export type TextLinkProps = WithElementRef<HTMLAnchorAttributes, HTMLAnchorElement> & {
	size?: TextLinkSize;
	/** Opens in a new tab with safe `rel` values and a trailing external-link icon. */
	external?: boolean;
	children?: Snippet;
};
