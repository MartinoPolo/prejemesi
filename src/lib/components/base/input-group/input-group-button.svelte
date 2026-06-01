<script lang="ts">
	import { cn } from '$lib/utils.js';
	import type { ComponentProps } from 'svelte';
	import { Button } from '$lib/components/base/button/index.js';
	import {
		inputGroupButtonVariants,
		type InputGroupButtonSize,
	} from './input_group_button_variants.js';

	let {
		ref = $bindable(null),
		class: className,
		children,
		type = 'button',
		intent = 'primary',
		size = 'xs',
		...restProps
	}: Omit<ComponentProps<typeof Button>, 'href' | 'size'> & {
		size?: InputGroupButtonSize;
	} = $props();
</script>

<Button
	bind:ref
	{type}
	data-size={size}
	{intent}
	class={cn(inputGroupButtonVariants({ size }), className)}
	{...restProps}
>
	{@render children?.()}
</Button>
