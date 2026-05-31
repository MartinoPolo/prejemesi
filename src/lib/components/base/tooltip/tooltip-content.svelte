<script lang="ts">
	import { Tooltip as TooltipPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';
	import TooltipPortal from './tooltip-portal.svelte';
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
		class={cn(
			'data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] has-data-[slot=kbd]:pr-1.5 **:data-[slot=kbd]:relative **:data-[slot=kbd]:isolate **:data-[slot=kbd]:z-50 **:data-[slot=kbd]:rounded-sm bg-surface-3 text-foreground border border-border-strong shadow-md z-(--z-tooltip) w-fit max-w-xs origin-(--bits-tooltip-content-transform-origin)',
			className,
		)}
		{...restProps}
	>
		{@render children?.()}
		<TooltipPrimitive.Arrow>
			{#snippet child({ props })}
				{@const cleanStyle = String(props.style ?? '').replace(
					/transform(-origin)?:[^;]+;?\s*/g,
					'',
				)}
				<div
					class={cn(
						'size-2.5 rotate-45 bg-surface-3 z-(--z-tooltip) border-border-strong',
						'data-[side=top]:border-b data-[side=top]:border-r data-[side=top]:translate-y-1/2',
						'data-[side=bottom]:border-t data-[side=bottom]:border-l data-[side=bottom]:-translate-y-1/2',
						'data-[side=left]:border-t data-[side=left]:border-r data-[side=left]:translate-x-1/2',
						'data-[side=right]:border-b data-[side=right]:border-l data-[side=right]:-translate-x-1/2',
						arrowClasses,
					)}
					{...props}
					style={cleanStyle}
				></div>
			{/snippet}
		</TooltipPrimitive.Arrow>
	</TooltipPrimitive.Content>
</TooltipPortal>
