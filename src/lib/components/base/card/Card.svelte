<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { cardVariants, type CardProps } from './card_variants.js';

	let {
		class: className,
		padding = 'none',
		state,
		accentBarColor,
		ref = $bindable(null),
		children,
		...restProps
	}: CardProps = $props();

	const dataState = $derived(state && state !== 'default' ? state : undefined);
</script>

<div
	bind:this={ref}
	data-slot="card"
	data-state={dataState}
	class={cn(
		cardVariants({ padding, state }),
		accentBarColor != null && 'overflow-hidden',
		className,
	)}
	{...restProps}
>
	{#if accentBarColor != null}
		<div class="absolute inset-y-0 left-0 z-2 w-0.75" style:background={accentBarColor}></div>
	{/if}
	{@render children?.()}
	{#if state === 'loading'}
		<div class="darecky-card-shimmer"></div>
	{/if}
</div>

<style>
	:global(.darecky-card-shimmer) {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			90deg,
			transparent 0%,
			color-mix(in oklch, var(--foreground) 4%, transparent) 50%,
			transparent 100%
		);
		background-size: 200% 100%;
		animation: shimmer 2s infinite linear;
	}
</style>
