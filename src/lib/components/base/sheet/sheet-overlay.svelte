<script lang="ts">
	import { getLayerPalette } from '$lib/theme/layer_palette.js';
	import { Dialog as SheetPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';

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
		'bg-scrim supports-backdrop-filter:backdrop-blur-[2.5px] fixed inset-0 z-(--z-modal)',
		className,
	)}
	{...restProps}
/>
