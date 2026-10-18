<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import BanIcon from '@lucide/svelte/icons/ban';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import EmailAddress from './EmailAddress.svelte';
	import FieldDiffList from './FieldDiffList.svelte';
	import GiftCardComparison from './GiftCardComparison.svelte';
	import type { ChangeRowModel, GiftChangeModel, RowConsequence } from './change_row_model.js';

	/** The changes column: what happens, field by field, and why a blocked row never applies. */
	let {
		model,
		consequenceId,
		reasonTone,
		reasonSuffix = null,
	}: {
		model: ChangeRowModel;
		consequenceId: string;
		reasonTone: 'warning' | 'danger';
		/** Appended to each reason, e.g. that a row which conflicted on apply will not apply. */
		reasonSuffix?: string | null;
	} = $props();
</script>

{#snippet consequenceText(consequence: RowConsequence)}
	<span>
		{#if consequence.email !== null}
			<EmailAddress address={consequence.email} />
		{/if}
		{consequence.text}
	</span>
{/snippet}

{#snippet giftChange(change: GiftChangeModel, showName: boolean)}
	<div class="gift-change">
		{#if showName}
			<p class="change-name">{change.name}</p>
		{/if}
		{#each change.appends as append, index (index)}
			<div class="append">
				<span class="append-label">{m.change_review_append_label()}</span>
				<ins class="append-text"
					><span class="sr-only">{m.change_review_diff_added()} </span>{append.text}</ins
				>
			</div>
		{/each}
		{#if change.originalDescription !== null}
			<p class="note">
				{m.change_review_original_description({ description: change.originalDescription })}
			</p>
		{/if}
		{#if change.diffs.length > 0}
			<FieldDiffList diffs={change.diffs} />
		{/if}
		{#if change.context !== null}
			<p class="note">{change.context}</p>
		{/if}
	</div>
{/snippet}

{#if model.consequence !== null}
	<p class="consequence" id={consequenceId}>
		<TriangleAlertIcon aria-hidden="true" />
		{@render consequenceText(model.consequence)}
	</p>
{/if}
{#each model.giftChanges as change (change.giftId)}
	{@render giftChange(change, model.giftChanges.length > 1)}
{/each}
{#if model.moreCount > 0}
	<p class="note">{m.change_review_reorder_more({ count: model.moreCount })}</p>
{/if}
{#each model.reasons as reason, index (index)}
	<p class={['reason', reasonTone]}>
		{#if reasonTone === 'warning'}
			<TriangleAlertIcon aria-hidden="true" />
		{:else}
			<BanIcon aria-hidden="true" />
		{/if}
		<span>{reasonSuffix === null ? reason : `${reason} ${reasonSuffix}`}</span>
	</p>
{/each}
{#if model.currentCards !== null}
	<details class="disclosure">
		<summary class="disclosure-toggle"
			><ChevronDownIcon aria-hidden="true" />{m.change_review_show_current()}</summary
		>
		<div class="disclosure-cards">
			<GiftCardComparison
				pair={model.currentCards}
				beforeCaption={m.change_review_caption_current()}
				afterCaption={m.change_review_caption_proposed()}
			/>
		</div>
	</details>
{/if}

<style>
	.gift-change {
		display: grid;
		gap: 6px;
	}

	.gift-change + .gift-change {
		margin-top: var(--space-3);
	}

	.change-name {
		font-size: var(--text-md);
		font-weight: 700;
	}

	.note {
		color: var(--muted-foreground);
		font-size: var(--text-sm);
	}

	.append {
		padding: 6px var(--space-3);
		border-left: 4px solid var(--accent-loud);
		border-radius: 0 10px 10px 0;
		background: color-mix(in oklab, var(--accent-loud) 16%, var(--card));
		font-size: var(--text-md);
	}

	.append-label {
		display: block;
		color: var(--muted-foreground);
		font-size: var(--text-xs);
		font-weight: 700;
	}

	.append-text {
		padding: 0 var(--space-1);
		border-radius: 4px;
		background: color-mix(in oklab, var(--status-success) 14%, var(--card));
		color: var(--status-success-text);
		font-weight: 600;
		text-decoration: none;
	}

	.append-text::before {
		content: '+ ';
		font-weight: 800;
	}

	.consequence,
	.reason {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		padding: var(--space-2) 10px;
		border-radius: 10px;
		font-size: var(--text-md);
		line-height: 1.4;
	}

	.consequence :global(svg),
	.reason :global(svg) {
		flex: none;
		width: 16px;
		height: 16px;
		margin-top: 1px;
	}

	.consequence {
		margin-bottom: var(--space-2);
		border: 2px solid var(--ink);
		background: color-mix(in oklab, var(--accent-loud) 22%, var(--card));
		font-weight: 600;
	}

	.reason {
		margin-top: var(--space-2);
	}

	.reason.warning {
		border: 2px solid color-mix(in oklab, var(--status-warning) 60%, var(--ink));
		background: color-mix(in oklab, var(--status-warning) 18%, var(--card));
	}

	.reason.danger {
		border: 2px solid color-mix(in oklab, var(--status-danger) 60%, var(--ink));
		background: color-mix(in oklab, var(--status-danger) 14%, var(--card));
	}

	.disclosure {
		margin-top: var(--space-2);
	}

	.disclosure-toggle {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: var(--size-control-sm);
		padding: 0 9px;
		border: 2.5px solid var(--ink);
		border-radius: var(--radius-btn);
		background: var(--card);
		box-shadow: var(--elevation-compact);
		font-size: var(--text-sm);
		font-weight: 600;
		list-style: none;
		cursor: pointer;
	}

	.disclosure-toggle::-webkit-details-marker {
		display: none;
	}

	.disclosure-toggle:hover {
		background: var(--panel-hover);
	}

	.disclosure[open] {
		--disclosure-chevron-rotate: 180deg;
	}

	.disclosure-toggle :global(svg) {
		width: 16px;
		height: 16px;
		rotate: var(--disclosure-chevron-rotate, 0deg);
	}

	.disclosure-cards {
		margin-top: 10px;
	}

	@media (width < 640px) {
		.disclosure-toggle {
			height: var(--size-control-lg);
			font-size: var(--text-md);
		}
	}
</style>
