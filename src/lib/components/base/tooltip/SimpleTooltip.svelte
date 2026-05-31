<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Tooltip as TooltipPrimitive } from 'bits-ui';
	import TooltipTrigger from './tooltip-trigger.svelte';
	import TooltipContent from './tooltip-content.svelte';

	interface Props {
		text: string;
		side?: 'top' | 'bottom' | 'left' | 'right';
		sideOffset?: number;
		delayDuration?: number | undefined;
		/** Span-wrap mode: content is wrapped in an inline-flex span trigger. */
		children?: Snippet;
		/** AsChild mode: snippet receives trigger props to spread onto the interactive element. */
		asChild?: Snippet<[Record<string, unknown>]>;
	}

	let {
		text,
		side = 'top',
		sideOffset = 6,
		delayDuration = undefined,
		children,
		asChild,
	}: Props = $props();
</script>

{#if delayDuration !== undefined}
	<TooltipPrimitive.Provider {delayDuration}>
		<TooltipPrimitive.Root>
			<TooltipTrigger>
				{#snippet child({ props })}
					{#if asChild}
						{@render asChild(props)}
					{:else}
						<span {...props} class="inline-flex items-center">
							{@render children?.()}
						</span>
					{/if}
				{/snippet}
			</TooltipTrigger>
			<TooltipContent {side} {sideOffset}>
				{text}
			</TooltipContent>
		</TooltipPrimitive.Root>
	</TooltipPrimitive.Provider>
{:else}
	<TooltipPrimitive.Provider>
		<TooltipPrimitive.Root>
			<TooltipTrigger>
				{#snippet child({ props })}
					{#if asChild}
						{@render asChild(props)}
					{:else}
						<span {...props} class="inline-flex items-center">
							{@render children?.()}
						</span>
					{/if}
				{/snippet}
			</TooltipTrigger>
			<TooltipContent {side} {sideOffset}>
				{text}
			</TooltipContent>
		</TooltipPrimitive.Root>
	</TooltipPrimitive.Provider>
{/if}
