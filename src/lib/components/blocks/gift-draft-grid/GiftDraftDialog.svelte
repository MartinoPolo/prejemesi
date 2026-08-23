<script lang="ts">
	import { untrack } from 'svelte';
	import * as Dialog from '$lib/components/base/dialog/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import * as Alert from '$lib/components/base/alert/index.js';
	import AlertTriangleIcon from '@lucide/svelte/icons/triangle-alert';
	import type { ValidatedGiftDraft } from '$lib/modules/gifts/gift_draft.js';
	import * as m from '$lib/paraglide/messages.js';
	import GiftDraftGrid from './GiftDraftGrid.svelte';
	import { DRAFT_GRID_CONTEXT, type DraftGridChange } from './gift_draft_grid_model.js';

	interface Props {
		open: boolean;
		wishlistTitle?: string;
		isSubmitting?: boolean;
		/** Show the priority heart column (hidden when the wishlist lacks ≥2 levels). */
		priorityAvailable?: boolean;
		serverDuplicateCount?: number;
		onsubmit?: (drafts: ValidatedGiftDraft[]) => void;
		onresetduplicatewarning?: () => void;
		oncancel?: () => void;
		onOpenChange?: (open: boolean) => void;
	}

	let {
		open = $bindable(false),
		wishlistTitle = '',
		isSubmitting = false,
		priorityAvailable = true,
		serverDuplicateCount = 0,
		onsubmit,
		onresetduplicatewarning,
		oncancel,
		onOpenChange,
	}: Props = $props();

	let drafts = $state<ValidatedGiftDraft[]>([]);
	let validCount = $state(0);
	let blockingCount = $state(0);
	let draftSignature = $state('');
	let gridKey = $state(0);
	const canSubmit = $derived(validCount > 0 && blockingCount === 0);

	function handleChange(change: DraftGridChange) {
		const nextSignature = JSON.stringify(change.drafts);
		if (serverDuplicateCount > 0 && nextSignature !== draftSignature) {
			onresetduplicatewarning?.();
		}
		draftSignature = nextSignature;
		drafts = change.drafts;
		validCount = change.validCount;
		blockingCount = change.blockingCount;
	}

	function handleSubmit() {
		if (!canSubmit) {
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
			draftSignature = '';
			validCount = 0;
			blockingCount = 0;
		});
	}
</script>

<Dialog.Root bind:open onOpenChange={handleOpenChange}>
	<Dialog.Content
		class="flex max-h-[90dvh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[1180px]"
	>
		<Dialog.Header class="border-b border-border px-6 py-5 text-left">
			<Dialog.Title class="font-heading text-2xl font-semibold tracking-tight">
				{m.draft_grid_dialog_title()}
			</Dialog.Title>
			<p class="mt-1 text-xs text-muted-foreground">
				{#if wishlistTitle}
					{m.batch_add_dialog_subtitle({ wishlistTitle })}
				{:else}
					{m.draft_grid_dialog_subtitle()}
				{/if}
			</p>
		</Dialog.Header>

		<div class="min-h-0 flex-1 overflow-auto px-4 py-4">
			{#key gridKey}
				<GiftDraftGrid
					context={DRAFT_GRID_CONTEXT.batch}
					{priorityAvailable}
					onchange={handleChange}
				/>
			{/key}
		</div>

		{#if serverDuplicateCount > 0}
			<div class="border-t border-border px-6 pt-4">
				<Alert.Root tone="warning">
					<AlertTriangleIcon class="size-4" />
					<Alert.Description>
						{m.batch_add_server_duplicates({ count: serverDuplicateCount })}
					</Alert.Description>
				</Alert.Root>
			</div>
		{/if}

		<Dialog.Footer class="flex flex-wrap items-center gap-4 border-t border-border px-6 py-4">
			{#if blockingCount > 0 && !isSubmitting}
				<HelpText state="error" class="m-0">
					{m.draft_grid_commit_hint_blocked_rows()}
				</HelpText>
			{:else if validCount === 0 && !isSubmitting}
				<HelpText state="error" class="m-0">{m.draft_grid_commit_hint_blocking()}</HelpText>
			{:else if validCount > 0}
				<span class="text-xs text-muted-foreground">
					{m.batch_add_hint_enabled({ count: validCount })}
				</span>
			{/if}
			<div class="flex-1"></div>
			<Button intent="ghost" onclick={handleCancel} disabled={isSubmitting}>
				{m.draft_grid_dialog_cancel()}
			</Button>
			<Button intent="primary" disabled={!canSubmit || isSubmitting} onclick={handleSubmit}>
				{#if isSubmitting}
					{m.batch_add_submit_pending()}
				{:else}
					{m.draft_grid_dialog_submit()}
				{/if}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
