<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';
	import ClipboardListIcon from '@lucide/svelte/icons/clipboard-list';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import { Button } from '$lib/components/base/button/index.js';
	import ApplyProposalLabel from '$lib/components/blocks/change-proposals/ApplyProposalLabel.svelte';
	import { countCopy } from '$lib/modules/change_proposals/change_review_copy.js';
	import { CHANGE_DECISION } from '$lib/modules/change_proposals/change_field_decisions.js';
	import { UNRESOLVED_DECISION_MESSAGES } from '$lib/components/blocks/change-proposals/change_review_presentation.js';
	import type { ProposalDecisions } from '$lib/components/blocks/change-proposals/proposal_decisions.svelte.js';
	import { PROPOSAL_TITLES } from './chat_presentation.js';

	/**
	 * The decisions on one chat proposal: its count, Zkontrolovat, and Zamítnout vše, Přijmout vše
	 * and Použít. Použít stays focusable while decisions are open, so pressing it can point at them.
	 */
	let {
		decisions,
		rowCount,
		inspecting,
		reviewHref,
		pending,
		oninspect,
		onapply,
		onlocate,
	}: {
		decisions: ProposalDecisions;
		rowCount: number;
		inspecting: boolean;
		/** Large proposals are checked on the review page instead of inline. */
		reviewHref: string | null;
		pending: boolean;
		oninspect: () => void;
		onapply: () => void;
		/** The decision bar scrolls the chat to the proposal it acts on. */
		onlocate?: () => void;
	} = $props();

	const blocked = $derived(decisions.unresolvedCount > 0);
	const declines = $derived(!blocked && decisions.includedCount === 0);
	const title = $derived(countCopy(PROPOSAL_TITLES, rowCount));
</script>

{#snippet count()}
	{#if decisions.showUnresolved && blocked}
		<span class="count is-blocked" role="status" data-testid="chat-proposal-unresolved">
			<TriangleAlertIcon aria-hidden="true" />
			{countCopy(UNRESOLVED_DECISION_MESSAGES, decisions.unresolvedCount)}
		</span>
	{:else if onlocate !== undefined}
		<button
			type="button"
			class="count locate"
			title={m.chat_locate_proposal()}
			onclick={onlocate}
		>
			<ClipboardListIcon aria-hidden="true" />{title}
		</button>
	{:else}
		<span class="count"><ClipboardListIcon aria-hidden="true" />{title}</span>
	{/if}
{/snippet}

{#snippet reviewButton()}
	{#if reviewHref !== null}
		<Button intent="ghost" size="sm" href={reviewHref}>
			{m.chat_review()}<ArrowRightIcon data-icon="inline-end" />
		</Button>
	{:else}
		<Button
			intent="ghost"
			size="sm"
			aria-expanded={inspecting}
			data-testid="chat-proposal-inspect"
			onclick={oninspect}
		>
			{m.chat_review()}
			{#if inspecting}
				<ChevronUpIcon data-icon="inline-end" />
			{:else}
				<ChevronDownIcon data-icon="inline-end" />
			{/if}
		</Button>
	{/if}
{/snippet}

<div class="controls" data-testid="chat-proposal-controls">
	<p class="count-line">
		{@render count()}
		{@render reviewButton()}
	</p>
	<div class="actions">
		<Button
			intent="secondary"
			size="md"
			disabled={pending}
			data-testid="chat-proposal-reject-all"
			onclick={() => decisions.decideEveryRow(CHANGE_DECISION.rejected)}
		>
			{m.change_review_reject_all()}
		</Button>
		<Button
			intent="secondary"
			size="md"
			disabled={pending}
			data-testid="chat-proposal-accept-all"
			onclick={() => decisions.decideEveryRow(CHANGE_DECISION.accepted)}
		>
			{m.change_review_accept_all()}
		</Button>
		<Button
			class={['apply', blocked && !pending && 'is-blocked']}
			intent={declines ? 'secondary' : 'primary'}
			size="md"
			disabled={pending}
			aria-disabled={blocked && !pending ? 'true' : undefined}
			aria-busy={pending}
			data-testid="chat-proposal-apply"
			onclick={onapply}
		>
			<ApplyProposalLabel {pending} {declines} includedCount={decisions.includedCount} />
		</Button>
	</div>
</div>

<style>
	.controls {
		display: grid;
		gap: var(--space-2);
	}

	.count-line {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		min-height: var(--size-control-sm);
	}

	.count {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
		font-size: var(--text-md);
		font-weight: 700;
	}

	.count :global(svg) {
		flex: none;
		width: 16px;
		height: 16px;
	}

	.locate {
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		cursor: pointer;
		text-align: start;
	}

	.locate:hover {
		text-decoration: underline;
	}

	.count.is-blocked {
		color: var(--status-danger-text);
	}

	.actions {
		display: grid;
		grid-template-columns: auto auto minmax(0, 1fr);
		gap: var(--space-2);
	}

	.actions :global(.is-blocked) {
		opacity: 0.55;
	}
</style>
