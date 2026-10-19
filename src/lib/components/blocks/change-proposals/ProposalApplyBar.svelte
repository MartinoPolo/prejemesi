<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import LoaderIcon from '@lucide/svelte/icons/loader';
	import { Button } from '$lib/components/base/button/index.js';
	import { countCopy } from '$lib/modules/change_proposals/change_review_copy.js';
	import { UNRESOLVED_DECISION_MESSAGES } from './change_review_presentation.js';

	const INCLUDED_COUNTS = {
		one: m.change_review_included_count_one,
		few: m.change_review_included_count_few,
		other: m.change_review_included_count_other,
	};
	const UNRESOLVED_HELP = {
		one: m.change_review_unresolved_help_one,
		few: m.change_review_unresolved_help_few,
		other: m.change_review_unresolved_help_other,
	};

	/**
	 * Sticky footer: how many changes apply, the global decisions and Použít. While a decision is
	 * open, Použít stays focusable but aria-disabled, and pressing it points at what is left.
	 */
	let {
		includedCount,
		unresolvedCount,
		showUnresolved,
		announcement,
		pending,
		onrejectall,
		onacceptall,
		onapply,
	}: {
		includedCount: number;
		unresolvedCount: number;
		/** Apply was pressed while decisions were open. */
		showUnresolved: boolean;
		/** Read out by screen readers when Apply was pressed too early. */
		announcement: string;
		pending: boolean;
		onrejectall: () => void;
		onacceptall: () => void;
		/** Applies, discards when everything is rejected, or points at the open decisions. */
		onapply: () => void;
	} = $props();

	const blocked = $derived(unresolvedCount > 0);
	const declines = $derived(!blocked && includedCount === 0);
	const help = $derived.by(() => {
		if (blocked) {
			return countCopy(UNRESOLVED_HELP, unresolvedCount);
		}
		return declines
			? m.change_review_apply_help_declined()
			: m.change_review_apply_help_batch();
	});
</script>

<div class="apply-bar" role="region" aria-label={m.change_review_apply_bar_label()}>
	<div class="apply-inner">
		<p class="apply-text">
			<span class="apply-count" data-testid="change-review-included-count">
				{countCopy(INCLUDED_COUNTS, includedCount)}
			</span>
			{#if showUnresolved && blocked}
				<span
					class="apply-message"
					id="change-review-apply-help"
					data-testid="change-review-unresolved-message"
				>
					{countCopy(UNRESOLVED_DECISION_MESSAGES, unresolvedCount)}
				</span>
			{:else}
				<span class="apply-help" id="change-review-apply-help">{help}</span>
			{/if}
		</p>
		<div class="apply-actions">
			<Button
				intent="secondary"
				disabled={pending}
				data-testid="change-review-reject-all"
				onclick={onrejectall}
			>
				{m.change_review_reject_all()}
			</Button>
			<Button
				intent="secondary"
				disabled={pending}
				data-testid="change-review-accept-all"
				onclick={onacceptall}
			>
				{m.change_review_accept_all()}
			</Button>
			<Button
				class={['apply-primary', blocked && !pending && 'is-blocked']}
				disabled={pending}
				aria-disabled={blocked && !pending ? 'true' : undefined}
				aria-busy={pending}
				aria-describedby="change-review-apply-help"
				data-testid="change-review-apply"
				onclick={onapply}
			>
				{#if pending}
					<LoaderIcon
						class="animate-spin"
						data-icon="inline-start"
					/>{m.change_review_applying()}
				{:else if declines}
					{m.change_review_decline_proposal()}
				{:else}
					{m.change_review_apply_included({ count: includedCount })}
				{/if}
			</Button>
		</div>
	</div>
	<p class="sr-only" role="status" aria-live="polite">{announcement}</p>
</div>

<style>
	/* A floating card with the change rows' border, radius and elevation, aligned to the page column. */
	.apply-bar {
		position: sticky;
		bottom: 0;
		z-index: 15;
		margin-top: var(--space-6);
		padding-bottom: var(--space-3);
		pointer-events: none;
	}

	.apply-inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px var(--space-4);
		min-height: 64px;
		padding: 10px var(--space-3) 10px var(--space-4);
		border: 2.5px solid var(--ink);
		border-radius: var(--radius-panel);
		background: var(--card);
		box-shadow: var(--elevation-ordinary);
		pointer-events: auto;
	}

	.apply-text {
		display: grid;
		gap: 2px;
		min-width: 0;
	}

	.apply-count {
		font-size: var(--text-base);
		font-weight: 700;
	}

	.apply-help {
		color: var(--muted-foreground);
		font-size: var(--text-sm);
	}

	.apply-message {
		color: var(--status-danger-text);
		font-size: var(--text-md);
		font-weight: 700;
	}

	.apply-actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: var(--nested-control-gap);
	}

	/* Raised buttons ignore the pointer while aria-disabled; a blocked Použít must still point at the open decisions. */
	.apply-actions :global(.is-blocked) {
		opacity: 0.45;
		cursor: not-allowed;
		pointer-events: auto;
	}

	@media (width < 640px) {
		.apply-bar {
			padding-bottom: calc(var(--space-2) + env(safe-area-inset-bottom));
		}

		.apply-inner {
			flex-direction: column;
			align-items: stretch;
			gap: var(--space-2);
			min-height: 72px;
			padding: 10px var(--space-3);
		}

		.apply-actions {
			display: grid;
			grid-template-columns: 1fr 1fr;
		}

		.apply-actions :global(.apply-primary) {
			grid-column: 1 / -1;
		}
	}
</style>
