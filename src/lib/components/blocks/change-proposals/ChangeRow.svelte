<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Badge } from '$lib/components/base/badge/index.js';
	import GiftImage from '$lib/components/blocks/gift/GiftImage.svelte';
	import {
		CHANGE_ROW_DISPLAY_STATUS,
		CHANGE_ROW_GROUP,
	} from '$lib/modules/change_proposals/change_review_decisions.js';
	import ChangeKindTitle from './ChangeKindTitle.svelte';
	import ChangeRowDetails from './ChangeRowDetails.svelte';
	import GiftCardComparison from './GiftCardComparison.svelte';
	import RowDecision from './RowDecision.svelte';
	import {
		CHANGE_KIND_PRESENTATION,
		CHANGE_ROW_STATUS_PRESENTATION,
	} from './change_review_presentation.js';
	import type { ChangeReviewActions, ReviewRowEntry } from './change_review_rows.js';

	/**
	 * One proposal row as a table row laid out as a panel: a header band tinted by change type
	 * holds the title, status and decision, the body holds the gift, its fields and card pair.
	 */
	let {
		entry,
		actions,
		showUnresolved,
	}: {
		entry: ReviewRowEntry;
		/** Absent once the proposal is closed. */
		actions: ChangeReviewActions | undefined;
		/** Outlines undecided controls after Apply was pressed too early. */
		showUnresolved: boolean;
	} = $props();

	const { rowId, kind } = $derived(entry.row);
	const { model, group, blocked, status, included, conflictedOnApply } = $derived(entry);
	const presentation = $derived(CHANGE_KIND_PRESENTATION[kind]);
	const statusPresentation = $derived(CHANGE_ROW_STATUS_PRESENTATION[status]);
	const cards = $derived(
		model.giftChanges.find((change) => change.cards !== null)?.cards ?? null,
	);
	const consequenceId = $derived(`change-consequence-${rowId}`);
	const muted = $derived(
		blocked ||
			(actions !== undefined && !included) ||
			status === CHANGE_ROW_DISPLAY_STATUS.notApplied ||
			status === CHANGE_ROW_DISPLAY_STATUS.discarded,
	);
	const inConfirm = $derived(group === CHANGE_ROW_GROUP.confirm);
	const dimmed = $derived(muted && !blocked && !inConfirm);
	const rowClasses = $derived([
		'change-row',
		cards === null ? 'slim' : 'has-cards',
		muted && 'is-muted',
		dimmed && 'is-dimmed',
		blocked && 'is-blocked',
		conflictedOnApply && 'is-new-conflict',
		status === CHANGE_ROW_DISPLAY_STATUS.changedSinceApply && 'is-changed-since',
		inConfirm && 'in-confirm',
		inConfirm && included && 'is-confirmed',
	]);
	const reasonTone = $derived(
		status === CHANGE_ROW_DISPLAY_STATUS.conflict ? 'warning' : 'danger',
	);
	const reasonSuffix = $derived(conflictedOnApply ? m.change_review_not_applied_note() : null);
</script>

{#snippet statusIcon()}
	{#if statusPresentation.icon !== null}<statusPresentation.icon data-icon />{/if}
{/snippet}

{#snippet giftIdentity()}
	<div class="identity">
		<span class={['thumb', model.identity.iconOnly && 'icon-thumb']} aria-hidden="true">
			{#if model.identity.iconOnly}
				<presentation.icon />
			{:else}
				<GiftImage
					class="size-full"
					imageUrl={model.identity.imageUrl}
					imageMeta={model.identity.imageMeta}
					target="thumb"
					variant="listThumb"
					alt=""
				/>
			{/if}
		</span>
		<span class="identity-text">
			<span class="gift-name">{model.identity.name}</span>
			{#if model.identity.sub !== null}
				<span class="gift-sub">{model.identity.sub}</span>
			{/if}
		</span>
	</div>
{/snippet}

<tr
	class={rowClasses}
	style:--band-mix={presentation.tone.bandMix}
	style:--band-strength={presentation.tone.bandStrength}
	data-testid="change-row"
	data-row-id={rowId}
	data-status={status}
	hidden={entry.hidden}
>
	<td class="cell-kind"><ChangeKindTitle {kind} /></td>
	<td class="cell-gift">{@render giftIdentity()}</td>
	<td class="cell-diffs">
		<ChangeRowDetails
			{entry}
			{consequenceId}
			{reasonTone}
			{reasonSuffix}
			{actions}
			{showUnresolved}
		/>
	</td>
	<td class="cell-status">
		<Badge
			tone={statusPresentation.tone}
			size="lg"
			icon={statusPresentation.icon === null ? undefined : statusIcon}
		>
			{statusPresentation.label()}
		</Badge>
		{#if actions !== undefined && entry.rowReview !== undefined}
			<RowDecision
				{entry}
				{actions}
				{showUnresolved}
				describedBy={model.consequence === null ? undefined : consequenceId}
			/>
		{/if}
	</td>
	<td class="cell-cards">
		{#if cards !== null}
			<GiftCardComparison pair={cards} />
		{/if}
	</td>
</tr>

<style>
	.change-row {
		--band-control-size: var(--size-control-md);
		--band-pad: 10px;
		--row-pad-x: var(--space-4);
		--row-border: 2px;
		--row-surface: var(--card);
		--band-bg: color-mix(in oklab, var(--band-mix) var(--band-strength), var(--row-surface));
		--band-divider: var(--ink);

		display: grid;
		align-items: start;
		gap: 10px 14px;
		padding: 0 var(--row-pad-x) 14px;
		border: var(--row-border) solid var(--ink);
		border-radius: var(--radius-panel);
		background: var(--row-surface);
		transition: background-color var(--duration-normal) var(--ease-standard);
	}

	/* The band is a grid item in the first track bled to the padding edge, so its top corners are the outer radius minus the border. */
	.change-row::before {
		content: '';
		grid-row: 1;
		grid-column: 1 / -1;
		align-self: stretch;
		margin-inline: calc(-1 * var(--row-pad-x));
		border-bottom: 2px solid var(--band-divider);
		border-radius: calc(var(--radius-panel) - var(--row-border))
			calc(var(--radius-panel) - var(--row-border)) 0 0;
		background: var(--band-bg);
	}

	.change-row:hover {
		--row-surface: color-mix(in oklab, var(--panel-hover) 70%, var(--card));
	}

	.change-row[hidden] {
		display: none;
	}

	.change-row > td {
		display: block;
		min-width: 0;
		padding: 0;
	}

	.cell-kind {
		grid-area: kind;
	}

	.cell-gift {
		grid-area: gift;
	}

	.cell-diffs {
		grid-area: diffs;
	}

	.cell-status {
		grid-area: status;
	}

	.cell-cards {
		grid-area: cards;
	}

	/* Band cells share padding and stretch to the band track, so title, status and decision centres align. */
	.change-row > .cell-kind,
	.change-row > .cell-status {
		display: flex;
		align-items: center;
		align-self: stretch;
		min-height: calc(var(--band-control-size) + 2 * var(--band-pad) + 2px);
		padding: var(--band-pad) 0 calc(var(--band-pad) + 2px);
	}

	.change-row > .cell-status {
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: var(--space-2);
	}

	.has-cards {
		grid-template:
			'kind status' auto
			'gift cards' auto
			'diffs cards' 1fr
			/ minmax(0, 1fr) auto;
	}

	.slim {
		grid-template-areas:
			'kind kind status'
			'gift diffs diffs';
		grid-template-columns: minmax(200px, 280px) minmax(0, 1fr) auto;
	}

	.slim > .cell-gift {
		display: flex;
		align-items: flex-start;
	}

	.slim > .cell-cards {
		display: none;
	}

	.has-cards > .cell-cards {
		padding-left: var(--space-4);
		border-left: 2px dashed var(--border-strong);
	}

	.is-muted {
		--row-surface: var(--muted);
	}

	.is-dimmed .cell-cards {
		opacity: 0.55;
	}

	.is-blocked {
		--band-bg: color-mix(in oklab, var(--ink) 6%, var(--muted));
		--band-divider: var(--border-strong);

		border-color: var(--border-strong);
	}

	.is-blocked .cell-cards {
		opacity: 0.6;
	}

	.is-new-conflict {
		border-color: var(--status-warning);
		box-shadow: 0 0 0 2px color-mix(in oklab, var(--status-warning) 40%, transparent);
	}

	.is-changed-since {
		border-color: var(--status-danger);
	}

	.in-confirm {
		--row-border: 2.5px;
	}

	.is-confirmed {
		box-shadow: var(--elevation-compact);
	}

	.identity {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
		min-width: 0;
	}

	.thumb {
		position: relative;
		display: grid;
		flex: none;
		place-items: center;
		width: 64px;
		height: 64px;
		overflow: hidden;
		border: 2.5px solid var(--ink);
		border-radius: var(--radius-badge);
		background: var(--surface);
		color: var(--ink);
	}

	.icon-thumb {
		background: var(--tint);
	}

	.icon-thumb :global(svg) {
		width: 28px;
		height: 28px;
	}

	.identity-text {
		min-width: 0;
		padding-top: var(--space-1);
	}

	.gift-name,
	.gift-sub {
		display: block;
		overflow-wrap: anywhere;
	}

	.gift-name {
		font-size: var(--text-base);
		font-weight: 700;
		line-height: 1.3;
	}

	.is-dimmed .gift-name {
		color: var(--muted-foreground);
	}

	.gift-sub {
		margin-top: 2px;
		color: var(--muted-foreground);
		font-size: var(--text-sm);
	}

	@container change-review (width < 900px) {
		.has-cards {
			grid-template-areas:
				'kind status'
				'gift gift'
				'diffs diffs'
				'cards cards';
			grid-template-rows: auto;
		}

		.slim {
			grid-template-areas:
				'kind status'
				'gift gift'
				'diffs diffs';
			grid-template-columns: minmax(0, 1fr) auto;
		}

		.has-cards > .cell-cards {
			padding: var(--space-3) 0 0;
			border-top: 2px dashed var(--border-strong);
			border-left: 0;
		}
	}

	@media (width < 640px) {
		.change-row {
			--band-control-size: var(--size-control-lg);
			--band-pad: var(--space-2);
			--row-pad-x: var(--space-3);

			column-gap: 10px;
			padding-bottom: var(--space-3);
		}

		/* Title and the decision controls do not both fit a phone band, so they open the row body. */
		.has-cards,
		.slim {
			row-gap: var(--space-2);
			grid-template-columns: minmax(0, 1fr);
		}

		.has-cards {
			grid-template-areas: 'kind' 'status' 'gift' 'diffs' 'cards';
		}

		.slim {
			grid-template-areas: 'kind' 'status' 'gift' 'diffs';
		}

		.change-row > .cell-status {
			align-self: start;
			justify-content: space-between;
			min-height: 0;
			padding: 0;
		}

		.thumb {
			width: 56px;
			height: 56px;
		}
	}
</style>
