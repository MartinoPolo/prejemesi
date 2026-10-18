<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import { CHANGE_ROW_GROUP } from '$lib/modules/change_proposals/change_review_selection.js';
	import ChangeTable from './ChangeTable.svelte';
	import {
		CHANGE_REVIEW_FILTER,
		type ChangeReviewFilter,
		type ReviewRowEntry,
	} from './change_review_rows.js';

	/** Confirmation rows first, ordinary rows in submitted order, rows that never apply folded last. */
	let {
		entries,
		interactive,
		filter,
		busy,
		onselectedchange,
	}: {
		entries: readonly ReviewRowEntry[];
		interactive: boolean;
		filter: ChangeReviewFilter;
		busy: boolean;
		onselectedchange: (rowId: string, selected: boolean) => void;
	} = $props();

	const confirmEntries = $derived(
		entries.filter((entry) => entry.group === CHANGE_ROW_GROUP.confirm),
	);
	const ordinaryEntries = $derived(
		entries.filter((entry) => entry.group === CHANGE_ROW_GROUP.ordinary),
	);
	const blockedEntries = $derived(
		entries.filter((entry) => entry.group === CHANGE_ROW_GROUP.blocked),
	);
	let blockedOpen = $state(false);

	function hasVisible(sectionEntries: readonly ReviewRowEntry[]): boolean {
		return sectionEntries.some((entry) => !entry.hidden);
	}
</script>

<div class="sections" inert={busy}>
	{#if hasVisible(confirmEntries)}
		<section class="section confirm-section" aria-labelledby="change-review-confirm-heading">
			<div class="section-head">
				<span class="confirm-mark" aria-hidden="true"><TriangleAlertIcon /></span>
				<h2 id="change-review-confirm-heading">{m.change_review_confirm_heading()}</h2>
				<p class="section-note">
					{interactive
						? m.change_review_confirm_note()
						: m.change_review_confirm_note_readonly()}
				</p>
			</div>
			<ChangeTable
				entries={confirmEntries}
				caption={m.change_review_confirm_heading()}
				{interactive}
				{onselectedchange}
			/>
		</section>
	{/if}
	{#if hasVisible(ordinaryEntries)}
		<section class="section" aria-labelledby="change-review-ordinary-heading">
			<div class="section-head">
				<h2 id="change-review-ordinary-heading">{m.change_review_ordinary_heading()}</h2>
				<p class="section-note">{m.change_review_ordinary_note()}</p>
			</div>
			<ChangeTable
				entries={ordinaryEntries}
				caption={m.change_review_ordinary_heading()}
				{interactive}
				{onselectedchange}
			/>
		</section>
	{/if}
	{#if hasVisible(blockedEntries)}
		<details
			class="blocked-section"
			open={blockedOpen || filter === CHANGE_REVIEW_FILTER.conflicts}
			ontoggle={(event) => (blockedOpen = event.currentTarget.open)}
		>
			<summary>
				<span class="chevron" aria-hidden="true"><ChevronDownIcon /></span>
				<h2>{m.change_review_blocked_heading({ count: blockedEntries.length })}</h2>
				<span class="section-note">{m.change_review_blocked_note()}</span>
			</summary>
			<div class="blocked-rows">
				<ChangeTable
					entries={blockedEntries}
					caption={m.change_review_blocked_heading({ count: blockedEntries.length })}
					{interactive}
					{onselectedchange}
				/>
			</div>
		</details>
	{/if}
</div>

<style>
	.sections[inert] {
		opacity: 0.6;
		cursor: progress;
	}

	.section,
	.blocked-section {
		margin-top: var(--space-5);
	}

	.section-head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--space-1) var(--space-3);
		margin-bottom: var(--space-3);
	}

	h2 {
		font-family: var(--font-head);
		font-size: var(--text-2xl);
		font-weight: 600;
		line-height: 1.3;
	}

	.section-note {
		color: var(--muted-foreground);
		font-size: var(--text-sm);
	}

	.confirm-section {
		padding: var(--space-4);
		border: 2.5px solid var(--ink);
		border-radius: 20px;
		background: color-mix(in oklab, var(--accent-loud) 22%, var(--card));
		box-shadow: var(--elevation-ordinary);
	}

	.confirm-section > .section-head {
		align-items: center;
	}

	.confirm-section .section-note {
		flex-basis: 100%;
		color: var(--foreground);
	}

	.confirm-mark {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border: 2px solid var(--ink);
		border-radius: 9px;
		background: var(--accent-loud);
		color: var(--accent-loud-foreground);
		transform: rotate(-3deg);
	}

	.confirm-mark :global(svg) {
		width: 18px;
		height: 18px;
	}

	.blocked-section {
		border: 2px solid var(--border-strong);
		border-radius: var(--radius-panel);
		background: color-mix(in oklab, var(--muted) 60%, transparent);
	}

	.blocked-section > summary {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-3);
		padding: var(--space-3) var(--space-4);
		border-radius: calc(var(--radius-panel) - 2px);
		list-style: none;
		cursor: pointer;
	}

	.blocked-section > summary::-webkit-details-marker {
		display: none;
	}

	.blocked-section > summary:hover {
		background: var(--panel-hover);
	}

	.chevron {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border: 2.5px solid var(--ink);
		border-radius: var(--radius-btn);
		background: var(--card);
		box-shadow: var(--elevation-compact);
	}

	.blocked-section[open] .chevron {
		--section-chevron-rotate: 180deg;
	}

	.chevron :global(svg) {
		width: 16px;
		height: 16px;
		rotate: var(--section-chevron-rotate, 0deg);
		transition: rotate var(--duration-normal) var(--ease-standard);
	}

	.blocked-rows {
		padding: 0 var(--space-4) var(--space-4);
	}

	@media (width < 640px) {
		.confirm-section {
			padding: var(--space-3);
			border-radius: 18px;
		}

		.blocked-section > summary {
			padding: var(--space-3);
		}

		.blocked-rows {
			padding: 0 var(--space-3) var(--space-3);
		}
	}
</style>
