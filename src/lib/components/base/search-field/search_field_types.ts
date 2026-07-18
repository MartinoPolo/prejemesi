import type { WithElementRef } from '$lib/utils.js';
import type { HTMLInputAttributes } from 'svelte/elements';
import type { Snippet } from 'svelte';
import type { InputSize } from '../input/input_variants.js';

type InputWithoutNativeSizeOrResults = Omit<HTMLInputAttributes, 'results' | 'size'>;

export type SearchFieldProps = WithElementRef<InputWithoutNativeSizeOrResults> & {
	size?: InputSize;
	children?: Snippet;
};
