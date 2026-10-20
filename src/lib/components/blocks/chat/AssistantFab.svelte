<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import XIcon from '@lucide/svelte/icons/x';

	/**
	 * The global entry: an icon button in the bottom-right corner whose label slides out on hover
	 * and focus. With the panel open on desktop it docks at the panel's edge and closes it.
	 */
	let {
		open,
		mobile,
		panelWidth,
		ontoggle,
	}: {
		open: boolean;
		mobile: boolean;
		/** The open desktop panel's width, which the button sits beside. */
		panelWidth: number;
		ontoggle: () => void;
	} = $props();

	const label = $derived(open ? m.chat_close() : m.chat_assistant_title());
</script>

{#if !(mobile && open)}
	<button
		type="button"
		class="fab"
		data-assistant-fab
		data-open={open}
		style:--panel-offset="{open ? panelWidth : 0}px"
		aria-expanded={open}
		aria-controls="assistant-panel"
		data-testid="assistant-fab"
		onclick={ontoggle}
	>
		<span class="fab-icon" aria-hidden="true">
			{#if open}<XIcon />{:else}<SparklesIcon />{/if}
		</span>
		<span class="fab-label">{label}</span>
	</button>
{/if}

<style>
	.fab {
		--fab-size: 52px;

		position: fixed;
		right: calc(var(--panel-offset) + var(--space-4));
		bottom: var(--space-4);
		z-index: var(--z-sticky);
		display: inline-flex;
		align-items: center;
		height: var(--fab-size);
		padding: 0;
		border: 2.5px solid var(--ink);
		border-radius: calc(var(--fab-size) / 2);
		background: var(--primary);
		box-shadow: var(--elevation-ordinary);
		color: var(--primary-foreground);
		font-weight: 700;
		cursor: pointer;
	}

	.fab:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: 3px;
	}

	.fab-icon {
		display: grid;
		flex: none;
		place-items: center;
		width: calc(var(--fab-size) - 5px);
		height: calc(var(--fab-size) - 5px);
	}

	.fab-icon :global(svg) {
		width: 22px;
		height: 22px;
	}

	/* Icon only at rest; the label slides out on hover and keyboard focus, never on scroll. */
	.fab-label {
		display: inline-block;
		max-width: 0;
		overflow: hidden;
		white-space: nowrap;
		transition: max-width var(--duration-normal) var(--ease-standard);
	}

	.fab:focus-visible .fab-label {
		max-width: 16rem;
		padding-inline-end: var(--space-4);
	}

	@media (hover: hover) {
		.fab:hover .fab-label {
			max-width: 16rem;
			padding-inline-end: var(--space-4);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.fab-label {
			transition: none;
		}
	}

	/*
	 * Toasts sit above the button so neither hides the other, beside the open desktop panel and
	 * above the open mobile sheet's composer, where the button hides; the panel publishes both
	 * clearances.
	 */
	:global(body:has([data-assistant-fab], #assistant-panel) [data-sonner-toaster]) {
		--offset-right: calc(var(--assistant-toast-right, 0px) + 24px) !important;
		--offset-bottom: calc(var(--space-4) + 52px + var(--space-3)) !important;
		--mobile-offset-bottom: calc(
			max(var(--space-4) + 52px, var(--assistant-toast-bottom, 0px)) + var(--space-3)
		) !important;
	}
</style>
