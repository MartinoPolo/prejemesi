<script lang="ts">
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import XIcon from '@lucide/svelte/icons/x';
	import { Checkbox } from '$lib/components/base/checkbox/index.js';
	import { Input } from '$lib/components/base/input/index.js';
	import { Textarea } from '$lib/components/base/textarea/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import { cn } from '$lib/utils.js';
	import { ROW_STATUS, type RowStatus } from '$lib/modules/gifts/draft_grid.js';
	import * as m from '$lib/paraglide/messages.js';
	import GiftDraftLinksCell from './GiftDraftLinksCell.svelte';
	import GiftDraftPriceCell from './GiftDraftPriceCell.svelte';
	import {
		draftRowStatusVariants,
		DRAFT_GRID_COLUMNS,
		DRAFT_COL_LABEL_CLASS,
		DRAFT_DESTRUCTIVE_HOVER_CLASS,
	} from './gift_draft_grid_variants.js';
	import type { DraftGridRow } from './gift_draft_grid_model.js';

	interface Props {
		row: DraftGridRow;
		/** Whole-card status derived by the grid (error > duplicate > ready). */
		status: RowStatus;
		/** Re-emit drafts after any edit/selection change. */
		onchange?: () => void;
		/** Remove this row entirely. */
		ondelete: () => void;
		/** Clear the possible-duplicate flag for this row. */
		ondismissduplicate: () => void;
	}

	let { row, status, onchange, ondelete, ondismissduplicate }: Props = $props();

	let editing = $state(false);

	const isError = $derived(status === ROW_STATUS.error);
	const isDuplicate = $derived(status === ROW_STATUS.duplicate);

	/** Any field edit marks the row touched (so a blank batch starter can turn red). */
	function markTouched() {
		row.pristine = false;
		onchange?.();
	}

	function toggleSelected(checked: boolean) {
		row.selected = checked;
		onchange?.();
	}
</script>

<div
	class={cn(
		'relative flex flex-col gap-3 rounded-lg border border-border bg-surface px-5 py-4 transition-[background,border-color,box-shadow] duration-(--duration-normal) hover:shadow-sm',
		DRAFT_GRID_COLUMNS,
		draftRowStatusVariants({ status }),
		row.selected ? '' : 'opacity-50',
		editing && 'shadow-[0_0_0_3px_color-mix(in_oklch,var(--ring)_16%,transparent)]',
	)}
	onfocusin={() => (editing = true)}
	onfocusout={() => (editing = false)}
>
	<!-- Mobile control bar: checkbox + tools (no header row exists on mobile) -->
	<div class="flex items-center gap-2 md:hidden">
		<Checkbox
			checked={row.selected}
			onCheckedChange={toggleSelected}
			aria-label={row.name.trim() === ''
				? m.draft_grid_select_row_unnamed()
				: m.draft_grid_select_row({ name: row.name })}
		/>
		<div class="flex-1"></div>
		<Button
			intent="ghost"
			size="icon-sm"
			disabled
			aria-label={m.draft_grid_enrich_row()}
			class="text-foreground-muted"
		>
			<SparklesIcon aria-hidden="true" />
		</Button>
		<Button
			intent="ghost"
			size="icon-sm"
			onclick={ondelete}
			aria-label={m.draft_grid_remove_row()}
			class={cn('text-foreground-muted', DRAFT_DESTRUCTIVE_HOVER_CLASS)}
		>
			<Trash2Icon aria-hidden="true" />
		</Button>
	</div>

	<!-- Desktop select cell (col 1) -->
	<div class="hidden md:flex md:min-h-(--size-control-md) md:items-center md:justify-center">
		<Checkbox
			checked={row.selected}
			onCheckedChange={toggleSelected}
			aria-label={row.name.trim() === ''
				? m.draft_grid_select_row_unnamed()
				: m.draft_grid_select_row({ name: row.name })}
		/>
	</div>

	<!-- Název (col 2) -->
	<div class="flex min-w-0 flex-col gap-1.5">
		<span class={cn(DRAFT_COL_LABEL_CLASS, 'md:hidden')}>
			{m.draft_grid_col_name()}
		</span>
		<Input
			type="text"
			value={row.name}
			oninput={(event) => {
				row.name = event.currentTarget.value;
				markTouched();
			}}
			state={isError ? 'error' : 'default'}
			aria-invalid={isError}
			placeholder={m.draft_grid_name_placeholder()}
			aria-label={m.draft_grid_col_name()}
			class="font-semibold"
		/>
		{#if isError}
			<HelpText state="error">
				<CircleAlertIcon class="size-3.5" aria-hidden="true" />
				{m.draft_grid_name_required()}
			</HelpText>
		{/if}
		{#if isDuplicate}
			<button
				type="button"
				onclick={ondismissduplicate}
				title={m.draft_grid_duplicate_dismiss()}
				class="inline-flex h-6 items-center gap-1.5 self-start rounded-full border border-[color-mix(in_oklch,var(--status-dup)_42%,transparent)] bg-[color-mix(in_oklch,var(--status-dup)_16%,transparent)] px-2.5 text-xs font-semibold text-[color-mix(in_oklch,var(--status-dup)_60%,var(--foreground))] transition-colors hover:bg-[color-mix(in_oklch,var(--status-dup)_26%,transparent)]"
			>
				<CopyIcon class="size-3" aria-hidden="true" />
				{m.draft_grid_duplicate_badge()}
				<XIcon class="size-3 opacity-70" aria-hidden="true" />
			</button>
		{/if}
	</div>

	<!-- Poznámka (col 3) -->
	<div class="flex min-w-0 flex-col gap-1.5">
		<span class={cn(DRAFT_COL_LABEL_CLASS, 'md:hidden')}>
			{m.draft_grid_col_note()}
		</span>
		<Textarea
			value={row.description}
			oninput={(event) => {
				row.description = event.currentTarget.value;
				markTouched();
			}}
			rows={1}
			placeholder={m.draft_grid_note_placeholder()}
			aria-label={m.draft_grid_col_note()}
		/>
	</div>

	<!-- Odkazy (col 4) -->
	<div class="flex min-w-0 flex-col gap-1.5">
		<span class={cn(DRAFT_COL_LABEL_CLASS, 'md:hidden')}>
			{m.draft_grid_col_links()}
		</span>
		<GiftDraftLinksCell links={row.links} onchange={markTouched} />
	</div>

	<!-- Cena (col 5) -->
	<div class="flex min-w-0 flex-col gap-1.5">
		<span class={cn(DRAFT_COL_LABEL_CLASS, 'md:hidden')}>
			{m.draft_grid_col_price()}
		</span>
		<GiftDraftPriceCell
			price={row.price}
			currency={row.currency}
			onPriceInput={(value) => {
				row.price = value;
				markTouched();
			}}
			onCurrencyChange={(value) => {
				row.currency = value;
				markTouched();
			}}
		/>
	</div>

	<!-- Desktop enrich placeholder (col 6) -->
	<div class="hidden md:flex md:justify-center md:pt-1">
		<Button
			intent="ghost"
			size="icon-sm"
			disabled
			aria-label={m.draft_grid_enrich_row()}
			class="text-foreground-muted"
		>
			<SparklesIcon aria-hidden="true" />
		</Button>
	</div>

	<!-- Desktop remove (col 7) -->
	<div class="hidden md:flex md:justify-center md:pt-1">
		<Button
			intent="ghost"
			size="icon-sm"
			onclick={ondelete}
			aria-label={m.draft_grid_remove_row()}
			class={cn('text-foreground-muted', DRAFT_DESTRUCTIVE_HOVER_CLASS)}
		>
			<Trash2Icon aria-hidden="true" />
		</Button>
	</div>
</div>
