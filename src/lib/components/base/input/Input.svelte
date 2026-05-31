<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { inputVariants, type InputProps } from './input_variants.js';

	let {
		ref = $bindable(null),
		value = $bindable(),
		type,
		files = $bindable(),
		state = 'default',
		class: className,
		'data-slot': dataSlot = 'input',
		...restProps
	}: InputProps & { files?: FileList | null } = $props();
</script>

{#if type === 'file'}
	<input
		bind:this={ref}
		data-slot={dataSlot}
		data-state={state}
		aria-invalid={state === 'error' ? true : undefined}
		class={cn(
			inputVariants({ state }),
			'file:h-7 file:text-sm file:font-medium file:text-foreground file:inline-flex file:border-0 file:bg-transparent',
			className,
		)}
		type="file"
		bind:files
		bind:value
		{...restProps}
	/>
{:else}
	<input
		bind:this={ref}
		data-slot={dataSlot}
		data-state={state}
		aria-invalid={state === 'error' ? true : undefined}
		class={cn(inputVariants({ state }), className)}
		{type}
		bind:value
		{...restProps}
	/>
{/if}
