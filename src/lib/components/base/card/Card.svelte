<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { cardVariants, type CardProps } from './card_variants.js';

	let {
		class: className,
		elevation = 'ordinary',
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
		cardVariants({ elevation, padding, state }),
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
		<div class="prejemesi-card-shimmer"></div>
	{/if}
</div>

<style>
	:global(.prejemesi-card-shimmer) {
		position: absolute;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
	}

	/* The gradient repeats every two card widths and slides one period per cycle, so the sweep
	   moves on the compositor instead of repainting the card each frame. */
	:global(.prejemesi-card-shimmer)::before {
		content: '';
		position: absolute;
		inset-block: 0;
		left: 0;
		width: 400%;
		background: linear-gradient(
				90deg,
				transparent 0%,
				color-mix(in oklab, var(--foreground) 4%, transparent) 50%,
				transparent 100%
			)
			0 0 / 50% 100%;
		translate: -50% 0;
		animation: card-shimmer-sweep 1s infinite linear;
	}

	@media (prefers-reduced-motion: reduce) {
		:global(.prejemesi-card-shimmer)::before {
			animation: none;
		}
	}

	@keyframes card-shimmer-sweep {
		to {
			translate: 0 0;
		}
	}
</style>
