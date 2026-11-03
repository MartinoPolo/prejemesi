<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';
	import ClipboardListIcon from '@lucide/svelte/icons/clipboard-list';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import { Button } from '$lib/components/base/button/index.js';
	import ApplyProposalLabel from '$lib/components/blocks/change-proposals/ApplyProposalLabel.svelte';
	import ProposalDecisionButtons from '$lib/components/blocks/change-proposals/ProposalDecisionButtons.svelte';
	import { countCopy } from '$lib/modules/change_proposals/change_review_copy.js';
	import { CHANGE_DECISION } from '$lib/modules/change_proposals/change_field_decisions.js';
	import { UNRESOLVED_DECISION_MESSAGES } from '$lib/components/blocks/change-proposals/change_review_presentation.js';
	import type { ProposalDecisions } from '$lib/components/blocks/change-proposals/proposal_decisions.svelte.js';
	import { keepFocusOnPress } from '$lib/reactivity/keyboard_inset.svelte.js';
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
		compact = false,
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
		/**
		 * While typing, one line of count and Použít; the count expands Zamítnout vše and Přijmout
		 * vše. Its controls keep the composer's focus, so the keyboard stays open.
		 */
		compact?: boolean;
	} = $props();

	let expanded = $state(false);

	const blocked = $derived(decisions.unresolvedCount > 0);
	const declines = $derived(!blocked && decisions.includedCount === 0);
	const title = $derived(countCopy(PROPOSAL_TITLES, rowCount));
	const onpointerdown = $derived(compact ? keepFocusOnPress : undefined);
</script>

{#snippet countLabel()}
	{#if decisions.showUnresolved && blocked}
		<span class="count is-blocked" role="status" data-testid="chat-proposal-unresolved">
			<TriangleAlertIcon aria-hidden="true" />
			{countCopy(UNRESOLVED_DECISION_MESSAGES, decisions.unresolvedCount)}
		</span>
	{:else}
		<span class="count"><ClipboardListIcon aria-hidden="true" />{title}</span>
	{/if}
{/snippet}

{#snippet bulkDecisions()}
	<ProposalDecisionButtons
		testIdPrefix="chat-proposal"
		size="md"
		disabled={pending}
		{onpointerdown}
		onrejectall={() => decisions.decideEveryRow(CHANGE_DECISION.rejected)}
		onacceptall={() => decisions.decideEveryRow(CHANGE_DECISION.accepted)}
	/>
{/snippet}

{#snippet applyButton()}
	<Button
		class={['apply', blocked && !pending && 'is-blocked']}
		intent={declines ? 'secondary' : 'primary'}
		size="md"
		disabled={pending}
		aria-disabled={blocked && !pending ? 'true' : undefined}
		aria-busy={pending}
		data-testid="chat-proposal-apply"
		{onpointerdown}
		onclick={onapply}
	>
		<ApplyProposalLabel {pending} {declines} includedCount={decisions.includedCount} />
	</Button>
{/snippet}

{#snippet count()}
	{#if (decisions.showUnresolved && blocked) || onlocate === undefined}
		{@render countLabel()}
	{:else}
		<button
			type="button"
			class="count locate"
			title={m.chat_locate_proposal()}
			onclick={onlocate}
		>
			<ClipboardListIcon aria-hidden="true" />{title}
		</button>
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

{#if compact}
	<div class="controls" data-testid="chat-proposal-controls" data-compact="">
		<div class="compact-line">
			<button
				type="button"
				class="expand"
				aria-expanded={expanded}
				aria-controls="chat-proposal-bulk-decisions"
				title={m.chat_decision_bar_more()}
				data-testid="chat-proposal-expand"
				onpointerdown={keepFocusOnPress}
				onclick={() => (expanded = !expanded)}
			>
				{@render countLabel()}
				<ChevronUpIcon class="chevron" aria-hidden="true" />
			</button>
			{@render applyButton()}
		</div>
		{#if expanded}
			<div class="bulk" id="chat-proposal-bulk-decisions">
				{@render bulkDecisions()}
			</div>
		{/if}
	</div>
{:else}
	<div class="controls" data-testid="chat-proposal-controls">
		<p class="count-line">
			{@render count()}
			{@render reviewButton()}
		</p>
		<div class="actions">
			{@render bulkDecisions()}
			{@render applyButton()}
		</div>
	</div>
{/if}

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

	.controls :global(.is-blocked) {
		opacity: 0.55;
	}

	.compact-line {
		display: flex;
		align-items: center;
		gap: var(--compact-control-gap);
	}

	.expand {
		display: flex;
		flex: 1;
		align-items: center;
		gap: var(--space-2);
		min-width: 0;
		min-height: var(--size-control-lg);
		padding: 0 var(--space-1);
		border: 0;
		border-radius: var(--radius-btn);
		background: none;
		color: inherit;
		text-align: start;
		cursor: pointer;
	}

	.expand:hover {
		background: var(--accent);
	}

	.expand:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: 2px;
	}

	.expand :global(.chevron) {
		flex: none;
		width: 16px;
		height: 16px;
		margin-inline-start: auto;
		transition: rotate var(--duration-normal) var(--ease-standard);
	}

	.expand[aria-expanded='true'] :global(.chevron) {
		rotate: 180deg;
	}

	.bulk {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--compact-control-gap);
	}

	@media (prefers-reduced-motion: reduce) {
		.expand :global(.chevron) {
			transition: none;
		}
	}
</style>
