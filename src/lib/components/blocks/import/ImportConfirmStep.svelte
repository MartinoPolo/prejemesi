<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/base/button/index.js';
	import { Progress } from '$lib/components/base/progress/index.js';
	import * as Alert from '$lib/components/base/alert/index.js';
	import type { GiftDraft } from '$lib/modules/gifts/gift_draft.js';
	import {
		WIZARD_MODE,
		COMMIT_STATUS,
		type WizardMode,
		type CommitStatus,
	} from './import_wizard_types.js';
	import CheckCircleIcon from '@lucide/svelte/icons/circle-check';
	import AlertCircleIcon from '@lucide/svelte/icons/circle-alert';
	import AlertTriangleIcon from '@lucide/svelte/icons/triangle-alert';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';

	interface ImportConfirmStepProps {
		mode: WizardMode;
		selectedDrafts: GiftDraft[];
		title?: string;
		wishlistTitle?: string;
		duplicateCount: number;
		oncommit: () => Promise<{ shortId: string }>;
		commitStatus: CommitStatus;
		suppressNavigation?: boolean;
	}

	let {
		mode,
		selectedDrafts,
		title,
		wishlistTitle,
		duplicateCount,
		oncommit,
		commitStatus,
		suppressNavigation = false,
	}: ImportConfirmStepProps = $props();

	let resultShortId = $state<string | null>(null);

	const displayTitle = $derived(mode === WIZARD_MODE.newList ? title : wishlistTitle);
	const giftCount = $derived(selectedDrafts.length);
	const isCommitting = $derived(commitStatus === COMMIT_STATUS.committing);
	const isSuccess = $derived(commitStatus === COMMIT_STATUS.success);
	const isError = $derived(commitStatus === COMMIT_STATUS.error);

	async function handleCommit() {
		try {
			const result = await oncommit();
			resultShortId = result.shortId;
		} catch {
			// Error state handled by parent via commitStatus
		}
	}
</script>

<div class="flex flex-col gap-5">
	{#if isSuccess}
		<!-- Success state -->
		<div class="flex flex-col items-center gap-3 py-4">
			<div class="text-status-success">
				<CheckCircleIcon class="size-10" strokeWidth={1.5} />
			</div>
			<p class="text-foreground text-center text-sm">
				{m.import_wizard_success({ count: giftCount })}
			</p>
			{#if resultShortId !== null && !suppressNavigation}
				<Button intent="primary" href={resolve('/(app)/w/[id]', { id: resultShortId })}>
					{m.import_wizard_success_open()}
					<ArrowRightIcon data-icon="inline-end" />
				</Button>
			{/if}
		</div>
	{:else}
		<!-- Summary line -->
		<div class="text-foreground text-sm">
			{#if mode === WIZARD_MODE.newList}
				{m.import_wizard_confirm_new_list({ title: displayTitle ?? '', count: giftCount })}
			{:else}
				{m.import_wizard_confirm_append({ title: displayTitle ?? '', count: giftCount })}
			{/if}
		</div>

		<!-- Duplicate caveat (append mode) -->
		{#if mode === WIZARD_MODE.append && duplicateCount > 0}
			<Alert.Root tone="warning">
				<AlertTriangleIcon class="size-4" />
				<Alert.Description>
					{m.import_wizard_confirm_duplicates({ count: duplicateCount })}
				</Alert.Description>
			</Alert.Root>
		{/if}

		<!-- Progress bar during commit -->
		{#if isCommitting}
			<div class="flex flex-col items-center gap-3 py-4">
				<Progress value={undefined} class="w-full" />
				<p class="text-muted-foreground text-sm">{m.import_wizard_committing()}</p>
			</div>
		{/if}

		<!-- Error state -->
		{#if isError}
			<Alert.Root tone="destructive">
				<AlertCircleIcon class="size-4" />
				<Alert.Description>{m.import_wizard_error_commit()}</Alert.Description>
			</Alert.Root>
		{/if}

		<!-- Commit button -->
		{#if !isCommitting}
			<Button onclick={handleCommit} disabled={isCommitting} class="w-full">
				{#if mode === WIZARD_MODE.newList}
					{m.import_wizard_commit_new()}
				{:else}
					{m.import_wizard_commit_append()}
				{/if}
			</Button>
		{/if}

		<!-- Retry button on error -->
		{#if isError}
			<Button intent="outline" onclick={handleCommit} class="w-full">
				{m.import_wizard_retry()}
			</Button>
		{/if}
	{/if}
</div>
