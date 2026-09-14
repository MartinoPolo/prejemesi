<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { inputVariants } from '$lib/components/base/input/input_variants.js';
	import {
		CONTROL_DIRECT_ICON_SIZE_CLASSES,
		RESPONSIVE_CONTROL_DIRECT_ICON_SIZE_CLASSES,
	} from '$lib/components/base/control_sizing.js';
	import SearchIcon from '@lucide/svelte/icons/search';
	import type { SearchFieldProps } from './search_field_types.js';

	let {
		ref = $bindable(null),
		value = $bindable(),
		children,
		size,
		class: className,
		...restProps
	}: SearchFieldProps = $props();
</script>

<div data-slot="search-field">
	<div
		class={cn(
			'relative',
			size == null
				? RESPONSIVE_CONTROL_DIRECT_ICON_SIZE_CLASSES
				: CONTROL_DIRECT_ICON_SIZE_CLASSES[size],
		)}
	>
		<SearchIcon
			class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
		/>
		<input
			bind:this={ref}
			bind:value
			data-slot="search-field-input"
			class={cn(inputVariants({ size: size ?? 'responsive' }), 'pl-9', className)}
			type="search"
			{...restProps}
		/>
	</div>
	{#if children}
		{@render children()}
	{/if}
</div>
