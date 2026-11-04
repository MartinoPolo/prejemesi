<script module lang="ts">
	import { tv } from 'tailwind-variants';

	const wishlistSheetChoiceVariants = tv({
		base: 'flex items-center gap-3 rounded-btn px-3 font-[650] hover:bg-accent',
		variants: {
			density: {
				/** Short single-choice lists such as sort and grouping. */
				comfortable: 'min-h-12 py-2',
				/** Long checklists such as filter facets, so more options fit the sheet. */
				compact: 'min-h-10 py-1',
			},
		},
		defaultVariants: { density: 'comfortable' },
	});

	type WishlistSheetChoiceDensity = keyof typeof wishlistSheetChoiceVariants.variants.density;
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLLabelAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils.js';

	interface Props extends HTMLLabelAttributes {
		children: Snippet;
		disabledStyle?: boolean;
		density?: WishlistSheetChoiceDensity;
	}

	let {
		children,
		disabledStyle = false,
		density = 'comfortable',
		class: className,
		...props
	}: Props = $props();
</script>

<label
	{...props}
	class={cn(
		wishlistSheetChoiceVariants({ density }),
		disabledStyle && 'cursor-not-allowed opacity-50',
		className,
	)}
>
	{@render children()}
</label>
