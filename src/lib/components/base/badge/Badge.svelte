<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { badgeVariants, type BadgeProps } from './badge_variants.js';

	let {
		class: className,
		tone = 'neutral',
		badgeStyle = 'outlined',
		size = 'default',
		icon,
		ref = $bindable(null),
		children,
		...restProps
	}: BadgeProps = $props();
</script>

<span
	bind:this={ref}
	data-slot="badge"
	class={cn(
		badgeVariants({ tone, badgeStyle, size }),
		'transition-colors duration-(--duration-normal) ease-(--ease-standard)',
		className,
	)}
	{...restProps}
>
	{#if icon}
		<span data-badge-icon class="inline-flex shrink-0">
			{@render icon()}
		</span>
	{/if}
	{#if children}
		<span
			data-badge-text
			class="inline-flex min-w-0 items-center gap-[inherit] overflow-hidden whitespace-nowrap"
		>
			{@render children()}
		</span>
	{/if}
</span>
