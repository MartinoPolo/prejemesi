<script lang="ts">
	import { getLayerPalette } from '$lib/theme/layer_palette.js';
	import ModalPageBlocker from '../modal_page_blocker.svelte';
	import { cn, type WithoutChildrenOrChild } from '$lib/utils.js';
	import DropdownMenuPortal from './dropdown-menu-portal.svelte';
	import { floatingDepthClearance } from '../floating_depth_clearance.js';
	import { fadeScaleOverlayMotionClass } from '../overlay_motion.js';
	import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';
	import type { ComponentProps } from 'svelte';

	let {
		ref = $bindable(null),
		sideOffset = 4,
		align = 'start',
		sticky = 'always',
		collisionPadding = 8,
		// The lock toggles user-select on <body> per press, restyling the whole document.
		preventOverflowTextSelection = false,
		portalProps,
		preventScroll = true,
		shadowedTrigger = true,
		class: className,
		...restProps
	}: DropdownMenuPrimitive.ContentProps & {
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof DropdownMenuPortal>>;
		/** Set false when the trigger has no resting shadow, so the layer needs no depth clearance. */
		shadowedTrigger?: boolean;
	} = $props();

	const layerPalette = getLayerPalette();
</script>

<DropdownMenuPortal {...portalProps}>
	<ModalPageBlocker active={preventScroll && ref !== null} />
	<DropdownMenuPrimitive.Content
		preventBodyPointerEvents={false}
		data-dark-palette={layerPalette()}
		bind:ref
		data-slot="dropdown-menu-content"
		{sideOffset}
		{align}
		{sticky}
		{collisionPadding}
		{preventOverflowTextSelection}
		{preventScroll}
		class={cn(
			fadeScaleOverlayMotionClass,
			'origin-(--bits-dropdown-menu-content-transform-origin) bg-popover text-popover-foreground min-w-32 rounded-panel border-[2.5px] border-edge p-1.5 shadow-sticker duration-100 z-(--z-modal) max-h-[calc(100dvh-1rem-var(--depth-clearance))] w-max max-w-[calc(100vw-1rem-var(--depth-clearance))] overflow-x-hidden overflow-y-auto overscroll-contain outline-none data-closed:overflow-hidden',
			shadowedTrigger && floatingDepthClearance,
			className,
		)}
		{...restProps}
	/>
</DropdownMenuPortal>
