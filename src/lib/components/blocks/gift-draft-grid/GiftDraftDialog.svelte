<script lang="ts">
	import * as Dialog from '$lib/components/base/dialog/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import type { GiftDraft } from '$lib/modules/gifts/gift_draft.js';
	import * as m from '$lib/paraglide/messages.js';
	import GiftDraftGrid from './GiftDraftGrid.svelte';
	import { DRAFT_GRID_CONTEXT, type DraftGridChange } from './gift_draft_grid_model.js';

	interface Props {
		/** Bindable open state of the batch-add dialog. */
		open: boolean;
		/** Fired with the committable drafts when the user confirms. */
		onsubmit?: (drafts: GiftDraft[]) => void;
		/** Fired when the user cancels/closes without committing. */
		oncancel?: () => void;
	}

	let { open = $bindable(false), onsubmit, oncancel }: Props = $props();

	let drafts = $state<GiftDraft[]>([]);
	let validCount = $state(0);

	function handleChange(change: DraftGridChange) {
		drafts = change.drafts;
		validCount = change.validCount;
	}

	function handleSubmit() {
		if (validCount === 0) {
			return;
		}
		onsubmit?.(drafts);
		open = false;
	}

	function handleCancel() {
		oncancel?.();
		open = false;
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content
		class="flex max-h-[90dvh] w-full max-w-[1100px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1100px]"
	>
		<Dialog.Header class="border-b border-border px-6 py-5 text-left">
			<Dialog.Title class="font-heading text-xl font-bold tracking-tight">
				{m.draft_grid_dialog_title()}
			</Dialog.Title>
			<p class="mt-1 text-xs text-foreground-muted">{m.draft_grid_dialog_subtitle()}</p>
		</Dialog.Header>

		<div class="min-h-0 flex-1 overflow-auto px-4 py-4">
			<GiftDraftGrid context={DRAFT_GRID_CONTEXT.batch} onchange={handleChange} />
		</div>

		<Dialog.Footer class="flex flex-wrap items-center gap-4 border-t border-border px-6 py-4">
			{#if validCount === 0}
				<HelpText state="error" class="m-0">{m.draft_grid_commit_hint_blocking()}</HelpText>
			{/if}
			<div class="flex-1"></div>
			<Button intent="ghost" onclick={handleCancel}>{m.draft_grid_dialog_cancel()}</Button>
			<Button intent="primary" disabled={validCount === 0} onclick={handleSubmit}>
				{m.draft_grid_dialog_submit()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
