<script lang="ts">
	import { Checkbox as CheckboxPrimitive } from 'bits-ui';
	import { cn, type WithoutChildrenOrChild } from '$lib/utils.js';
	import CheckboxSurface from './CheckboxSurface.svelte';
	import { checkboxVariants, type CheckboxSize } from './checkbox_variants.js';

	let {
		ref = $bindable(null),
		checked = $bindable(false),
		indeterminate = $bindable(false),
		class: className,
		size,
		disabled = false,
		...restProps
	}: Omit<WithoutChildrenOrChild<CheckboxPrimitive.RootProps>, 'size'> & {
		size?: CheckboxSize;
	} = $props();

	const styles = $derived(checkboxVariants({ size: size ?? 'responsive' }));
</script>

<CheckboxPrimitive.Root
	bind:ref
	data-slot="checkbox"
	class={cn(styles.owner(), className)}
	bind:checked
	bind:indeterminate
	{disabled}
	{...restProps}
>
	{#snippet children({ checked: rootChecked, indeterminate: rootIndeterminate })}
		<CheckboxSurface
			{size}
			checked={rootChecked}
			indeterminate={rootIndeterminate}
			disabled={disabled === true}
		/>
	{/snippet}
</CheckboxPrimitive.Root>
