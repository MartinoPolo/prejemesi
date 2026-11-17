<script lang="ts">
	import { getLayerPalette } from '$lib/theme/layer_palette.js';
	import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';
	import DropdownMenuPortal from './dropdown-menu-portal.svelte';
	import { floatingDepthClearance } from '../floating_depth_clearance.js';
	import { fadeScaleOverlayMotionClass } from '../overlay_motion.js';

	let {
		ref = $bindable(null),
		align = 'start',
		alignOffset = -4,
		sideOffset = 2,
		sticky = 'always',
		collisionPadding = 8,
		// The lock toggles user-select on <body> per press, restyling the whole document.
		preventOverflowTextSelection = false,
		class: className,
		...restProps
	}: DropdownMenuPrimitive.SubContentProps = $props();

	const layerPalette = getLayerPalette();
</script>

<!-- Keep floating coordinates independent of the parent menu's entrance transform. Its trigger sits
     in the portalled parent menu, outside the page's scroll container, so scroll events never reach
     the submenu's position updates; tracking every frame keeps it attached to the moving parent. -->
<DropdownMenuPortal>
	<DropdownMenuPrimitive.SubContent
		data-dark-palette={layerPalette()}
		bind:ref
		updatePositionStrategy="always"
		{align}
		{alignOffset}
		{sideOffset}
		{sticky}
		{collisionPadding}
		{preventOverflowTextSelection}
		data-slot="dropdown-menu-sub-content"
		class={cn(
			fadeScaleOverlayMotionClass,
			'origin-(--bits-menu-content-transform-origin) bg-popover text-popover-foreground min-w-24 rounded-panel border-[2.5px] border-edge p-1.5 shadow-sticker duration-100 z-(--z-modal) max-h-[calc(100dvh-1rem-var(--depth-clearance))] w-auto overflow-x-hidden overflow-y-auto overscroll-contain outline-none',
			floatingDepthClearance,
			className,
		)}
		{...restProps}
	/>
</DropdownMenuPortal>
