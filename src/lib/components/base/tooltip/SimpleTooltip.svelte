<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Tooltip as TooltipPrimitive } from 'bits-ui';
	import TooltipTrigger from './tooltip-trigger.svelte';
	import TooltipContent from './tooltip-content.svelte';
	import { hasSharedTooltipProvider } from './tooltip_provider_context.js';

	interface Props {
		text: string;
		side?: 'top' | 'bottom' | 'left' | 'right';
		sideOffset?: number;
		delayDuration?: number | undefined;
		/** When true, the tooltip never opens (used to suppress it while an attached popover/menu is open). */
		disabled?: boolean;
		/** Span-wrap mode: content is wrapped in an inline-flex span trigger. */
		children?: Snippet;
		/** AsChild mode: snippet receives trigger props to spread onto the interactive element. */
		asChild?: Snippet<[Record<string, unknown>]>;
	}

	const componentId = $props.id();
	// The app shell's shared Provider lets a neighbouring tooltip open instantly; a tooltip rendered
	// outside it (isolated tests, stories) brings its own.
	const usesSharedProvider = hasSharedTooltipProvider();
	const contentId = `${componentId}-content`;

	let {
		text,
		side = 'top',
		sideOffset = 6,
		delayDuration = undefined,
		disabled = false,
		children,
		asChild,
	}: Props = $props();

	let tooltipOpen = $state(false);
	let acceptsOpenFromCurrentInteraction = $state(false);

	function getTooltipOpen() {
		return !disabled && tooltipOpen;
	}

	function setTooltipOpen(open: boolean) {
		if (!open) {
			tooltipOpen = false;
			return;
		}

		if (!disabled && acceptsOpenFromCurrentInteraction) {
			tooltipOpen = true;
		}
	}

	function handleTriggerPointerEnter() {
		if (!disabled) {
			acceptsOpenFromCurrentInteraction = true;
		}
	}

	function handleTriggerPointerLeave() {
		acceptsOpenFromCurrentInteraction = false;
	}

	function handleTriggerFocus(event: FocusEvent) {
		if (
			!disabled &&
			event.currentTarget instanceof HTMLElement &&
			event.currentTarget.matches(':focus-visible')
		) {
			acceptsOpenFromCurrentInteraction = true;
		}
	}

	function handleTriggerBlur() {
		acceptsOpenFromCurrentInteraction = false;
	}

	$effect(() => {
		if (disabled) {
			acceptsOpenFromCurrentInteraction = false;
			tooltipOpen = false;
		}
	});
</script>

{#snippet tooltip()}
	<TooltipPrimitive.Root bind:open={getTooltipOpen, setTooltipOpen} {delayDuration} {disabled}>
		<TooltipTrigger
			onpointerenter={handleTriggerPointerEnter}
			onpointerleave={handleTriggerPointerLeave}
			onfocus={handleTriggerFocus}
			onblur={handleTriggerBlur}
		>
			{#snippet child({ props })}
				{@const accessibleTriggerProps = {
					...props,
					'aria-describedby': getTooltipOpen() ? contentId : undefined,
				}}
				{#if asChild}
					{@render asChild(accessibleTriggerProps)}
				{:else}
					<span {...accessibleTriggerProps} class="inline-flex items-center">
						{@render children?.()}
					</span>
				{/if}
			{/snippet}
		</TooltipTrigger>
		{#if !disabled}
			<TooltipContent {side} {sideOffset}>
				<span id={contentId}>{text}</span>
			</TooltipContent>
		{/if}
	</TooltipPrimitive.Root>
{/snippet}

{#if usesSharedProvider}
	{@render tooltip()}
{:else}
	<TooltipPrimitive.Provider>
		{@render tooltip()}
	</TooltipPrimitive.Provider>
{/if}
