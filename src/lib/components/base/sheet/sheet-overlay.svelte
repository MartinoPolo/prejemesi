<script lang="ts">
	import { getLayerPalette } from '$lib/theme/layer_palette.js';
	import { Dialog as SheetPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';
	import { fadeOverlayMotionClass } from '../overlay_motion.js';

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: SheetPrimitive.OverlayProps = $props();

	const layerPalette = getLayerPalette();
</script>

<SheetPrimitive.Overlay
	data-dark-palette={layerPalette()}
	bind:ref
	data-slot="sheet-overlay"
	class={cn(
		// Matches the content's exit so the overlay keeps blocking the page until the sheet is gone.
		fadeOverlayMotionClass,
		'bg-scrim supports-backdrop-filter:backdrop-blur-[2.5px] duration-200 fixed inset-0 z-(--z-modal)',
		className,
	)}
	{...restProps}
/>
