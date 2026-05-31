<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { inputVariants } from '$lib/components/base/input/input_variants.js';
	import SearchIcon from '@lucide/svelte/icons/search';
	import type { SearchFieldProps } from './search_field_variants.js';

	let {
		ref = $bindable(null),
		value = $bindable(),
		children,
		class: className,
		...restProps
	}: SearchFieldProps = $props();
</script>

<div data-slot="search-field">
	<div class="relative">
		<SearchIcon
			class="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-foreground-subtle"
		/>
		<input
			bind:this={ref}
			bind:value
			data-slot="search-field-input"
			class={cn(inputVariants(), 'pl-9', className)}
			type="search"
			{...restProps}
		/>
	</div>
	{#if children}
		{@render children()}
	{/if}
</div>
