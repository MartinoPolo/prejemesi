<script lang="ts">
	import { getLayerPalette } from '$lib/theme/layer_palette.js';
	import { Dialog as SheetPrimitive } from 'bits-ui';
	import type { Snippet } from 'svelte';
	import SheetPortal from './sheet-portal.svelte';
	import SheetOverlay from './sheet-overlay.svelte';
	import { Button } from '$lib/components/base/button/index.js';
	import XIcon from '@lucide/svelte/icons/x';
	import ModalPageBlocker from '../modal_page_blocker.svelte';
	import { markModalLayer } from '../modal_layer_context.js';
	import { cn, type WithoutChildrenOrChild } from '$lib/utils.js';
	import type { ComponentProps } from 'svelte';
	import type { Side } from './index.js';
	import {
		overlayCloseButtonClass,
		overlayCloseButtonSurfaceClass,
	} from '$lib/components/base/dialog/dialog_close_button.js';
	import * as m from '$lib/paraglide/messages.js';
	import { fasterExitMotionClass } from '../overlay_motion.js';

	let {
		ref = $bindable(null),
		class: className,
		side = 'right',
		showCloseButton = true,
		portalProps,
		children,
		...restProps
	}: WithoutChildrenOrChild<SheetPrimitive.ContentProps> & {
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof SheetPortal>>;
		side?: Side;
		showCloseButton?: boolean;
		children: Snippet;
	} = $props();

	const layerPalette = getLayerPalette();
	markModalLayer();
</script>

<SheetPortal {...portalProps}>
	<ModalPageBlocker active={ref !== null} blockEnclosingLayer />
	<SheetOverlay />
	<!-- The overlay and blocker cover the page; pointer-events on <body> would restyle every element. -->
	<SheetPrimitive.Content
		preventBodyPointerEvents={false}
		data-dark-palette={layerPalette()}
		bind:ref
		data-slot="sheet-content"
		data-side={side}
		class={cn(
			fasterExitMotionClass,
			'bg-card text-card-foreground border-edge fixed z-(--z-modal) flex flex-col gap-4 bg-clip-padding text-sm transition duration-200 ease-(--ease-drawer) data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:border-t-[2.5px] data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r-[2.5px] data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l-[2.5px] data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b-[2.5px] data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm starting:opacity-0 data-ending-style:opacity-0 data-[side=bottom]:starting:translate-y-10 data-[side=bottom]:data-ending-style:translate-y-10 data-[side=left]:starting:-translate-x-10 data-[side=left]:data-ending-style:-translate-x-10 data-[side=right]:starting:translate-x-10 data-[side=right]:data-ending-style:translate-x-10 data-[side=top]:starting:-translate-y-10 data-[side=top]:data-ending-style:-translate-y-10',
			className,
		)}
		{...restProps}
	>
		{@render children?.()}
		{#if showCloseButton}
			<SheetPrimitive.Close data-slot="sheet-close">
				{#snippet child({ props })}
					<Button
						intent="ghost"
						size="sm"
						format="icon"
						class={overlayCloseButtonClass}
						surfaceClass={overlayCloseButtonSurfaceClass}
						{...props}
					>
						<XIcon data-icon="inline-start" />
						<span class="sr-only">{m.close()}</span>
					</Button>
				{/snippet}
			</SheetPrimitive.Close>
		{/if}
	</SheetPrimitive.Content>
</SheetPortal>
