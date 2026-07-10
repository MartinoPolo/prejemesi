<script lang="ts">
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import type { Snippet } from 'svelte';
	import DialogPortal from './dialog-portal.svelte';
	import DialogOverlay from './dialog-overlay.svelte';
	import { Button } from '$lib/components/base/button/index.js';
	import XIcon from '@lucide/svelte/icons/x';
	import { cn, type WithoutChildrenOrChild } from '$lib/utils.js';
	import type { ComponentProps } from 'svelte';

	let {
		ref = $bindable(null),
		class: className,
		showCloseButton = true,
		portalProps,
		children,
		...restProps
	}: WithoutChildrenOrChild<DialogPrimitive.ContentProps> & {
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof DialogPortal>>;
		showCloseButton?: boolean;
		children: Snippet;
	} = $props();
</script>

<DialogPortal {...portalProps}>
	<DialogOverlay />
	<DialogPrimitive.Content
		bind:ref
		data-slot="dialog-content"
		class={cn(
			'bg-card text-card-foreground data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 fixed top-[50%] left-[50%] z-(--z-modal) grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-panel border-[2.5px] border-ink p-6 shadow-sticker duration-200 sm:max-w-lg',
			className,
		)}
		{...restProps}
	>
		{@render children?.()}
		{#if showCloseButton}
			<DialogPrimitive.Close data-slot="dialog-close">
				{#snippet child({ props })}
					<Button intent="ghost" class="absolute top-4 right-4" size="icon-sm" {...props}>
						<XIcon data-icon="inline-start" />
						<span class="sr-only">Close</span>
					</Button>
				{/snippet}
			</DialogPrimitive.Close>
		{/if}
	</DialogPrimitive.Content>
</DialogPortal>
