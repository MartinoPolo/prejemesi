<script lang="ts">
	import { getLayerPalette } from '$lib/theme/layer_palette.js';
	import { ContextMenu as ContextMenuPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';
	import { floatingDepthClearance } from '../floating_depth_clearance.js';
	import { slidingFadeScaleOverlayMotionClass } from '../overlay_motion.js';

	let {
		ref = $bindable(null),
		align = 'start',
		alignOffset = -4,
		sideOffset = 2,
		class: className,
		...restProps
	}: ContextMenuPrimitive.SubContentProps = $props();

	const layerPalette = getLayerPalette();
</script>

<ContextMenuPrimitive.SubContent
	data-dark-palette={layerPalette()}
	bind:ref
	{align}
	{alignOffset}
	{sideOffset}
	data-slot="context-menu-sub-content"
	class={cn(
		slidingFadeScaleOverlayMotionClass,
		'origin-(--bits-menu-content-transform-origin) bg-popover text-popover-foreground min-w-24 rounded-panel border-[2.5px] border-edge p-1.5 shadow-sticker duration-100 z-(--z-modal) w-auto overflow-x-hidden overflow-y-auto overscroll-contain outline-none',
		floatingDepthClearance,
		className,
	)}
	{...restProps}
/>
