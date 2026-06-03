<script lang="ts">
	import * as Dialog from '$lib/components/base/dialog/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import GiftDraftGrid from './GiftDraftGrid.svelte';
	import {
		createBlankRow,
		getValidSelectedCount,
		isDirty,
		toGiftDraftInputs,
		type GridDraftRow,
	} from './gift_draft_grid.js';
	import type { GiftDraftInput } from '$lib/modules/gifts/types.js';

	interface GiftDraftDialogProps {
		open: boolean;
		wishlistTitle: string;
		isSubmitting?: boolean;
		onsubmit: (drafts: GiftDraftInput[]) => void;
		onopenchange: (open: boolean) => void;
	}

	let {
		open = $bindable(),
		wishlistTitle,
		isSubmitting = false,
		onsubmit,
		onopenchange,
	}: GiftDraftDialogProps = $props();

	let rows = $state<GridDraftRow[]>([createBlankRow()]);

	const validCount = $derived(getValidSelectedCount(rows));
	const canSubmit = $derived(validCount > 0 && !isSubmitting);

	$effect(() => {
		if (!open) {
			resetGrid();
		}
	});

	function handleRowsChange(nextRows: GridDraftRow[]) {
		rows = nextRows;
	}

	function handleSubmit() {
		rows = rows.map((r) => ({ ...r, touched: true }));

		const drafts = toGiftDraftInputs(rows);
		if (drafts.length === 0) {
			return;
		}

		onsubmit(drafts);
	}

	function handleOpenChange(next: boolean | undefined) {
		const nextValue = next ?? false;
		if (isSubmitting) {
			return;
		}
		if (!nextValue && isDirty(rows)) {
			const confirmed = confirm(m.batch_add_discard_message());
			if (!confirmed) {
				return;
			}
		}
		open = nextValue;
		onopenchange(nextValue);
	}

	function handleCancel() {
		handleOpenChange(false);
	}

	function resetGrid() {
		rows = [createBlankRow()];
	}
</script>

<Dialog.Root bind:open onOpenChange={handleOpenChange}>
	<Dialog.Content class="flex max-h-[90dvh] max-w-[1100px] flex-col">
		<Dialog.Header>
			<Dialog.Title class="font-heading text-lg">{m.batch_add_dialog_title()}</Dialog.Title>
			<Dialog.Description>
				{m.batch_add_dialog_subtitle({ wishlistTitle })}
			</Dialog.Description>
		</Dialog.Header>

		<!-- Scrollable body -->
		<div class="flex-1 overflow-y-auto px-1 py-3">
			<GiftDraftGrid {rows} onrowschange={handleRowsChange} />
		</div>

		<!-- Pinned footer -->
		<Dialog.Footer class="flex items-center gap-3 border-t pt-3">
			<span class="text-muted-foreground mr-auto text-xs">
				{#if canSubmit}
					{m.batch_add_hint_enabled({ count: validCount })}
				{:else}
					{m.batch_add_hint_disabled()}
				{/if}
			</span>

			<Button intent="ghost" onclick={handleCancel} disabled={isSubmitting}>
				{m.cancel()}
			</Button>
			<Button disabled={!canSubmit} onclick={handleSubmit}>
				{#if isSubmitting}
					{m.batch_add_submit_pending()}
				{:else}
					{m.batch_add_submit()}
				{/if}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
