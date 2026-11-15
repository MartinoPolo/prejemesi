<script lang="ts">
	import { getLayerPalette } from '$lib/theme/layer_palette.js';
	import { Popover as PopoverPrimitive } from 'bits-ui';
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils.js';
	import { floatingDepthClearance } from '../floating_depth_clearance.js';
	import { slidingFadeScaleOverlayMotionClass } from '../overlay_motion.js';

	let {
		ref = $bindable(null),
		class: className,
		sideOffset = 6,
		side = 'bottom' as const,
		align = 'start' as const,
		children,
		portalProps,
		shadowedTrigger = true,
		...restProps
	}: PopoverPrimitive.ContentProps & {
		children?: Snippet;
		portalProps?: Omit<PopoverPrimitive.PortalProps, 'children'>;
		/** Set false when the trigger has no resting shadow, so the layer needs no depth clearance. */
		shadowedTrigger?: boolean;
	} = $props();

	const layerPalette = getLayerPalette();
</script>

<PopoverPrimitive.Portal {...portalProps}>
	<!-- Keyboard accessibility is handled by bits-ui automatically:
	     - Focus moves to first focusable element on open (no trapFocus – Tab cycles freely)
	     - Tab/Shift+Tab cycles through all focusable items inside the popover
	     - Space/Enter activates buttons and checkboxes
	     - Escape closes via bits-ui's escape-layer system (topmost layer only)
	  -->
	<PopoverPrimitive.Content
		data-dark-palette={layerPalette()}
		bind:ref
		data-slot="popover-content"
		{sideOffset}
		{side}
		{align}
		class={cn(
			'origin-(--bits-popover-content-transform-origin) duration-150',
			slidingFadeScaleOverlayMotionClass,
			'z-(--z-modal) min-w-55 rounded-panel border-[2.5px] border-edge bg-popover text-popover-foreground px-1.5 py-1.5 shadow-sticker outline-none',
			shadowedTrigger && floatingDepthClearance,
			className,
		)}
		{...restProps}
	>
		{@render children?.()}
	</PopoverPrimitive.Content>
</PopoverPrimitive.Portal>
