import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

export type PopoverItemProps = {
	ref?: HTMLDivElement | null;
	class?: string;
	active?: boolean;
	children?: Snippet;
} & HTMLAttributes<HTMLDivElement>;
