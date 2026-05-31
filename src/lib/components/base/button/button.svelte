<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { buttonVariants, type ButtonProps } from './button_variants.js';

	let {
		class: className,
		intent = 'primary',
		size = 'md',
		ref = $bindable(null),
		href = undefined,
		type = 'button',
		disabled,
		children,
		...restProps
	}: ButtonProps = $props();
</script>

{#if href != null}
	<!-- eslint-disable svelte/no-navigation-without-resolve -->
	<a
		bind:this={ref}
		data-slot="button"
		class={cn(buttonVariants({ intent, size }), className)}
		href={disabled === true ? undefined : href}
		aria-disabled={disabled}
		role={disabled === true ? 'link' : undefined}
		tabindex={disabled === true ? -1 : undefined}
		{...restProps}
	>
		{@render children?.()}
	</a>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
{:else}
	<button
		bind:this={ref}
		data-slot="button"
		class={cn(buttonVariants({ intent, size }), className)}
		{type}
		{disabled}
		{...restProps}
	>
		{@render children?.()}
	</button>
{/if}
