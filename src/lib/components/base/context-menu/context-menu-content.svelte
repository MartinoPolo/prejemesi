<script lang="ts">
	import { getLayerPalette } from '$lib/theme/layer_palette.js';
	import { cn, type WithoutChildrenOrChild } from '$lib/utils.js';
	import ContextMenuPortal from './context-menu-portal.svelte';
	import {
		floatingAvailableSizeCap,
		floatingDepthClearance,
	} from '../floating_depth_clearance.js';
	import { slidingFadeScaleOverlayMotionClass } from '../overlay_motion.js';
	import { ContextMenu as ContextMenuPrimitive } from 'bits-ui';
	import type { ComponentProps } from 'svelte';

	let {
		ref = $bindable(null),
		sideOffset = 4,
		align = 'start',
		portalProps,
		class: className,
		...restProps
	}: ContextMenuPrimitive.ContentProps & {
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof ContextMenuPortal>>;
	} = $props();

	const layerPalette = getLayerPalette();
</script>

<ContextMenuPortal {...portalProps}>
	<ContextMenuPrimitive.Content
		data-dark-palette={layerPalette()}
		bind:ref
		data-slot="context-menu-content"
		{sideOffset}
		{align}
		class={cn(
			slidingFadeScaleOverlayMotionClass,
			'origin-(--bits-context-menu-content-transform-origin) bg-popover text-popover-foreground min-w-32 rounded-panel border-[2.5px] border-edge p-1.5 shadow-sticker duration-100 z-(--z-modal) w-(--bits-context-menu-anchor-width) overflow-x-hidden overflow-y-auto overscroll-contain outline-none data-closed:overflow-hidden',
			floatingDepthClearance,
			floatingAvailableSizeCap,
			className,
		)}
		{...restProps}
	/>
</ContextMenuPortal>
