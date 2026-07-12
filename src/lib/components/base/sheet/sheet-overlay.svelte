<script lang="ts">
	import { Dialog as SheetPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: SheetPrimitive.OverlayProps = $props();
</script>

<SheetPrimitive.Overlay
	bind:ref
	data-slot="sheet-overlay"
	class={cn(
		'bg-[color-mix(in_oklab,var(--p-ink)_45%,transparent)] supports-backdrop-filter:backdrop-blur-[2.5px] fixed inset-0 z-(--z-modal)',
		className,
	)}
	{...restProps}
/>
