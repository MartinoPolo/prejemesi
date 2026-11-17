<script lang="ts">
	import { getLayerPalette } from '$lib/theme/layer_palette.js';
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';
	import { fadeOverlayMotionClass } from '../overlay_motion.js';

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: DialogPrimitive.OverlayProps = $props();

	const layerPalette = getLayerPalette();
</script>

<DialogPrimitive.Overlay
	data-dark-palette={layerPalette()}
	bind:ref
	data-slot="dialog-overlay"
	class={cn(
		fadeOverlayMotionClass,
		'bg-scrim supports-backdrop-filter:backdrop-blur-[2.5px] duration-150 fixed inset-0 z-(--z-modal)',
		className,
	)}
	{...restProps}
/>
