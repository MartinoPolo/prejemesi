import type { WithElementRef } from '$lib/utils.js';
import type { HTMLInputAttributes } from 'svelte/elements';
import type { Snippet } from 'svelte';

type InputWithoutResults = Omit<HTMLInputAttributes, 'results'>;

export type SearchFieldProps = WithElementRef<InputWithoutResults> & {
	children?: Snippet;
};
