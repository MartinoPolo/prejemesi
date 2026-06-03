<script lang="ts">
	import { untrack } from 'svelte';
	import * as Dialog from '$lib/components/base/dialog/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import type { GiftDraft } from '$lib/modules/gifts/gift_draft.js';
	import * as m from '$lib/paraglide/messages.js';
	import GiftDraftGrid from './GiftDraftGrid.svelte';
	import { DRAFT_GRID_CONTEXT, type DraftGridChange } from './gift_draft_grid_model.js';

	interface Props {
		open: boolean;
		wishlistTitle?: string;
		isSubmitting?: boolean;
		onsubmit?: (drafts: GiftDraft[]) => void;
		oncancel?: () => void;
		onOpenChange?: (open: boolean) => void;
	}

	let {
		open = $bindable(false),
		wishlistTitle = '',
		isSubmitting = false,
		onsubmit,
		oncancel,
		onOpenChange,
	}: Props = $props();

	let drafts = $state<GiftDraft[]>([]);
	let validCount = $state(0);
	let gridKey = $state(0);

	function handleChange(change: DraftGridChange) {
		drafts = change.drafts;
		validCount = change.validCount;
	}

	function handleSubmit() {
		if (validCount === 0) {
			return;
		}
		onsubmit?.(drafts);
	}

	function handleCancel() {
		oncancel?.();
		open = false;
	}

	function handleOpenChange(next: boolean | undefined) {
		const nextValue = next ?? false;
		if (isSubmitting) {
			return;
		}
		onOpenChange?.(nextValue);
		if (!nextValue) {
			open = false;
			resetState();
		}
	}

	function resetState() {
		untrack(() => {
			gridKey++;
			drafts = [];
			validCount = 0;
		});
	}
</script>

<Dialog.Root bind:open onOpenChange={handleOpenChange}>
	<Dialog.Content
		class="flex max-h-[90dvh] w-full max-w-[1100px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1100px]"
	>
		<Dialog.Header class="border-b border-border px-6 py-5 text-left">
			<Dialog.Title class="font-heading text-xl font-bold tracking-tight">
				{m.draft_grid_dialog_title()}
			</Dialog.Title>
			<p class="mt-1 text-xs text-foreground-muted">
				{#if wishlistTitle}
					{m.batch_add_dialog_subtitle({ wishlistTitle })}
				{:else}
					{m.draft_grid_dialog_subtitle()}
				{/if}
			</p>
		</Dialog.Header>

		<div class="min-h-0 flex-1 overflow-auto px-4 py-4">
			{#key gridKey}
				<GiftDraftGrid context={DRAFT_GRID_CONTEXT.batch} onchange={handleChange} />
			{/key}
		</div>

		<Dialog.Footer class="flex flex-wrap items-center gap-4 border-t border-border px-6 py-4">
			{#if validCount === 0 && !isSubmitting}
				<HelpText state="error" class="m-0">{m.draft_grid_commit_hint_blocking()}</HelpText>
			{:else if validCount > 0}
				<span class="text-xs text-foreground-muted">
					{m.batch_add_hint_enabled({ count: validCount })}
				</span>
			{/if}
			<div class="flex-1"></div>
			<Button intent="ghost" onclick={handleCancel} disabled={isSubmitting}>
				{m.draft_grid_dialog_cancel()}
			</Button>
			<Button
				intent="primary"
				disabled={validCount === 0 || isSubmitting}
				onclick={handleSubmit}
			>
				{#if isSubmitting}
					{m.batch_add_submit_pending()}
				{:else}
					{m.draft_grid_dialog_submit()}
				{/if}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
