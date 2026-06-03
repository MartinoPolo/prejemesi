<script lang="ts">
	import { untrack } from 'svelte';
	import Checkbox from '$lib/components/base/checkbox/Checkbox.svelte';
	import { Button } from '$lib/components/base/button/index.js';
	import GiftDraftRow from './GiftDraftRow.svelte';
	import GiftDraftBulkBar from './GiftDraftBulkBar.svelte';
	import {
		setGiftDraftGridContext,
		type ExistingGift,
	} from './gift_draft_grid.context.svelte.js';
	import type { GiftDraft } from '$lib/modules/gifts/gift_draft.js';
	import type { GiftDraftInput } from '$lib/modules/gifts/types.js';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		initialDrafts: GiftDraft[];
		existingGifts?: ExistingGift[];
		mode?: 'import' | 'batch';
		onCommitReady?: (rows: GiftDraftInput[]) => void;
	}

	let { initialDrafts, existingGifts = [], mode = 'import', onCommitReady }: Props = $props();

	const context = untrack(() =>
		setGiftDraftGridContext({
			initialDrafts,
			existingGifts,
			mode,
		}),
	);

	const selectAllChecked = $derived(context.selectAllState === 'all');
	const selectAllIndeterminate = $derived(context.selectAllState === 'indeterminate');

	function handleSelectAllChange() {
		context.toggleSelectAll();
	}

	$effect(() => {
		onCommitReady?.(context.committableRows);
	});
</script>

<div class="flex flex-col gap-3" data-testid="draft-grid">
	{#if mode === 'import'}
		<!-- Status legend -->
		<div class="flex flex-wrap items-center gap-4 text-xs text-foreground-muted">
			<span class="flex items-center gap-1.5">
				<span
					class="size-3 rounded-sm bg-[color-mix(in_oklab,var(--status-success)_50%,var(--surface))]"
				></span>
				{m.draft_grid_legend_ready()}
			</span>
			<span class="flex items-center gap-1.5">
				<span
					class="size-3 rounded-sm bg-[color-mix(in_oklab,var(--status-dup)_50%,var(--surface))]"
				></span>
				{m.draft_grid_legend_duplicate()}
			</span>
			<span class="flex items-center gap-1.5">
				<CircleAlertIcon class="size-3 text-status-danger" />
				{m.draft_grid_legend_error()}
			</span>
		</div>
	{/if}

	<!-- Bulk bar -->
	<GiftDraftBulkBar />

	<!-- Grid header (desktop) -->
	<div
		class="sticky top-0 z-20 hidden items-center gap-3 rounded-lg bg-surface-3 px-4 py-2 text-xs font-medium text-foreground-muted sm:grid sm:grid-cols-[44px_2.1fr_1.6fr_2fr_168px_44px_44px]"
		data-testid="grid-header"
	>
		<div class="flex justify-center">
			<Checkbox
				checked={selectAllChecked}
				indeterminate={selectAllIndeterminate}
				onCheckedChange={handleSelectAllChange}
				aria-label={selectAllIndeterminate
					? m.draft_grid_select_all_partial()
					: m.draft_grid_select_all()}
			/>
		</div>
		<span>{m.draft_grid_column_name()}</span>
		<span>{m.draft_grid_column_notes()}</span>
		<span>{m.draft_grid_column_links()}</span>
		<span>{m.draft_grid_column_price()}</span>
		<span class="text-center">{m.draft_grid_column_enrich()}</span>
		<span class="text-center">{m.draft_grid_column_remove()}</span>
	</div>

	<!-- Grid body -->
	<div class="flex flex-col gap-2" data-testid="grid-body">
		<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -- row used by Svelte each-block key -->
		{#each context.rows as row, index (index)}
			<GiftDraftRow {index} />
		{/each}
	</div>

	<!-- Add row button (batch mode only) -->
	{#if mode === 'batch'}
		<Button intent="ghost" size="sm" onclick={() => context.addRow()} class="self-start">
			<PlusIcon data-icon="inline-start" />
			{m.draft_grid_add_row()}
		</Button>
	{/if}
</div>
