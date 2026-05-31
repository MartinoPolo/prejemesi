<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { badgeVariants, type BadgeProps } from './badge_variants.js';

	let {
		class: className,
		tone = 'neutral',
		badgeStyle = 'outlined',
		format = 'default',
		size = 'default',
		collapsed = false,
		dot,
		icon,
		ref = $bindable(null),
		children,
		...restProps
	}: BadgeProps = $props();

	const BADGE_TRANSITION = [
		'padding 200ms linear',
		'gap 200ms linear',
		'background-color 150ms ease-in-out',
		'color 150ms ease-in-out',
		'border-color 150ms ease-in-out',
	].join(', ');

	const TEXT_TRANSITION = ['opacity 150ms ease-in-out', 'max-width 200ms ease-in-out'].join(', ');
</script>

<span
	bind:this={ref}
	data-slot="badge"
	class={cn(
		badgeVariants({ tone, badgeStyle, format, size }),
		collapsed && 'min-w-5 px-1 gap-0 rounded-full',
		className,
	)}
	style:transition={BADGE_TRANSITION}
	{...restProps}
>
	{#if icon}
		<span data-badge-icon class="inline-flex shrink-0">
			{@render icon()}
		</span>
	{/if}
	{#if dot}
		<span
			class={cn(
				'size-1.5 shrink-0 rounded-full bg-current',
				dot === 'pulsing' && 'animate-badge-pulse',
			)}
		></span>
	{/if}
	{#if children}
		<span
			data-badge-text
			class="inline-flex overflow-hidden whitespace-nowrap"
			style:opacity={collapsed ? '0' : '1'}
			style:max-width={collapsed ? '0px' : '200px'}
			style:transition={TEXT_TRANSITION}
		>
			{@render children()}
		</span>
	{/if}
</span>
