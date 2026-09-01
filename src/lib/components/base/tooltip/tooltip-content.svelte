<script lang="ts">
	import { Tooltip as TooltipPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';
	import TooltipPortal from './tooltip-portal.svelte';
	import { tooltipContentShellClass, tooltipContentVariants } from './tooltip_variants.js';
	import type { ComponentProps } from 'svelte';
	import type { WithoutChildrenOrChild } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		sideOffset = 0,
		side = 'top',
		children,
		arrowClasses,
		portalProps,
		...restProps
	}: TooltipPrimitive.ContentProps & {
		arrowClasses?: string;
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof TooltipPortal>>;
	} = $props();
</script>

<TooltipPortal {...portalProps}>
	<TooltipPrimitive.Content
		bind:ref
		data-slot="tooltip-content"
		{sideOffset}
		{side}
		class={tooltipContentShellClass}
		{...restProps}
	>
		<div class={cn(tooltipContentVariants(), className)}>
			{@render children?.()}
		</div>
		<TooltipPrimitive.Arrow>
			{#snippet child({ props })}
				{@const cleanStyle = String(props.style ?? '').replace(
					/transform(-origin)?:[^;]*;?\s*/g,
					'',
				)}
				<div
					class={cn(
						// Rotated square whose center sits ON the content edge: the inner
						// (borderless, bg-card) half paints over the bubble's edge border —
						// erasing the seam so the arrow reads as the bubble's mouth — while
						// the two bordered outer faces form the tip. bits-ui's own transform
						// is stripped above so only these `translate`/`rotate` props apply.
						'size-2.5 rotate-45 bg-card z-(--z-tooltip) border-ink',
						'data-[side=top]:translate-y-1/2 data-[side=top]:border-r-2 data-[side=top]:border-b-2',
						'data-[side=bottom]:-translate-y-1/2 data-[side=bottom]:border-t-2 data-[side=bottom]:border-l-2',
						'data-[side=left]:translate-x-1/2 data-[side=left]:border-t-2 data-[side=left]:border-r-2',
						'data-[side=right]:-translate-x-1/2 data-[side=right]:border-b-2 data-[side=right]:border-l-2',
						arrowClasses,
					)}
					{...props}
					style={cleanStyle}
				></div>
			{/snippet}
		</TooltipPrimitive.Arrow>
	</TooltipPrimitive.Content>
</TooltipPortal>
