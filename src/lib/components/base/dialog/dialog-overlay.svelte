<script lang="ts">
	import { getLayerPalette } from '$lib/theme/layer_palette.js';
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';

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
		'bg-scrim supports-backdrop-filter:backdrop-blur-[2.5px] data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 fixed inset-0 z-(--z-modal)',
		className,
	)}
	{...restProps}
/>
