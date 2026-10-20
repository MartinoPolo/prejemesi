<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import { Button } from '$lib/components/base/button/index.js';

	/** A failed or cut-off answer: whether anything changed, and Zkusit znovu when it can retry. */
	let {
		proposed,
		onretry,
	}: {
		/** The answer got as far as a proposal, so something may have changed. */
		proposed: boolean;
		/** Absent while the turn cannot be retried. */
		onretry?: () => void;
	} = $props();
</script>

<div class="turn-error" role="group" aria-labelledby="assistant-turn-error">
	<TriangleAlertIcon aria-hidden="true" />
	<p class="title" id="assistant-turn-error">{m.chat_error_title()}</p>
	{#if !proposed}
		<p class="detail">{m.chat_error_nothing_changed()}</p>
	{/if}
	{#if onretry !== undefined}
		<div class="detail">
			<Button intent="secondary" size="sm" data-testid="assistant-retry" onclick={onretry}>
				<RefreshCwIcon data-icon="inline-start" />{m.chat_retry()}
			</Button>
		</div>
	{/if}
</div>

<style>
	.turn-error {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: 4px var(--space-2);
		padding: var(--space-3);
		border: 2px solid color-mix(in oklab, var(--status-danger) 60%, var(--ink));
		border-radius: var(--chat-surface-radius);
		background: color-mix(in oklab, var(--status-danger) 12%, var(--card));
		font-size: var(--text-md);
	}

	.turn-error > :global(svg) {
		width: 16px;
		height: 16px;
		margin-top: 2px;
		color: var(--status-danger-text);
	}

	.title {
		font-weight: 700;
	}

	.detail {
		grid-column: 2;
	}
</style>
