<script lang="ts">
	import { Popover as PopoverPrimitive } from 'bits-ui';
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		sideOffset = 6,
		side = 'bottom' as const,
		align = 'start' as const,
		children,
		portalProps,
		...restProps
	}: PopoverPrimitive.ContentProps & {
		children?: Snippet;
		portalProps?: Omit<PopoverPrimitive.PortalProps, 'children'>;
	} = $props();
</script>

<PopoverPrimitive.Portal {...portalProps}>
	<!-- Keyboard accessibility is handled by bits-ui automatically:
	     - Focus moves to first focusable element on open (no trapFocus — Tab cycles freely)
	     - Tab/Shift+Tab cycles through all focusable items inside the popover
	     - Space/Enter activates buttons and checkboxes
	     - Escape closes via bits-ui's escape-layer system (topmost layer only)
	  -->
	<PopoverPrimitive.Content
		bind:ref
		data-slot="popover-content"
		{sideOffset}
		{side}
		{align}
		class={cn(
			'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
			'z-(--z-dropdown) min-w-55 rounded-lg border border-border bg-background px-1.5 py-1.5 shadow-lg outline-none',
			className,
		)}
		{...restProps}
	>
		{@render children?.()}
	</PopoverPrimitive.Content>
</PopoverPrimitive.Portal>
