<script lang="ts">
	import { getLayerPalette } from '$lib/theme/layer_palette.js';
	import { Select as SelectPrimitive } from 'bits-ui';
	import SelectPortal from './select-portal.svelte';
	import {
		floatingAvailableSizeCap,
		floatingDepthClearance,
	} from '../floating_depth_clearance.js';
	import { slidingFadeScaleOverlayMotionClass } from '../overlay_motion.js';
	import { cn, type WithoutChild } from '$lib/utils.js';
	import type { ComponentProps } from 'svelte';
	import type { WithoutChildrenOrChild } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		sideOffset = 4,
		sticky = 'always',
		collisionPadding = 8,
		portalProps,
		children,
		preventScroll = true,
		...restProps
	}: WithoutChild<SelectPrimitive.ContentProps> & {
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof SelectPortal>>;
	} = $props();

	const layerPalette = getLayerPalette();
</script>

<SelectPortal {...portalProps}>
	<SelectPrimitive.Content
		data-dark-palette={layerPalette()}
		bind:ref
		{sideOffset}
		{sticky}
		{collisionPadding}
		{preventScroll}
		data-slot="select-content"
		class={cn(
			slidingFadeScaleOverlayMotionClass,
			'origin-(--bits-select-content-transform-origin) bg-popover text-popover-foreground min-w-36 rounded-panel border-[2.5px] border-edge p-1 shadow-sticker duration-100 relative isolate z-(--z-modal) flex flex-col overflow-x-hidden',
			floatingDepthClearance,
			floatingAvailableSizeCap,
			className,
		)}
		{...restProps}
	>
		<SelectPrimitive.Viewport
			class={cn(
				'min-h-0 w-full min-w-(--bits-select-anchor-width) flex-1 scroll-my-1 overflow-y-auto',
			)}
		>
			{@render children?.()}
		</SelectPrimitive.Viewport>
	</SelectPrimitive.Content>
</SelectPortal>
