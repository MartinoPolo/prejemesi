<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Dialog from '$lib/components/base/dialog/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Separator } from '$lib/components/base/separator/index.js';
	import ImportSourceStep from './ImportSourceStep.svelte';
	import ImportReviewStep from './ImportReviewStep.svelte';
	import ImportConfirmStep from './ImportConfirmStep.svelte';
	import {
		WIZARD_STEP,
		WIZARD_STEPS,
		WIZARD_MODE,
		COMMIT_STATUS,
		type WizardStep,
		type CommitStatus,
	} from './import_wizard_types.js';
	import type { GiftDraft } from '$lib/modules/gifts/gift_draft.js';
	import type { GiftLink } from '$lib/modules/gifts/types.js';
	import { importGifts, createWishlistFromImport } from '$lib/modules/import/import.remote.js';
	import { findDuplicates } from '$lib/modules/gifts/gift_draft.js';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import XIcon from '@lucide/svelte/icons/x';

	/**
	 * Props modeled as a discriminated union so callers cannot pass wishlistId
	 * without mode='append' or omit it when mode='append'. The internal
	 * destructuring uses the wider InternalProps type to satisfy $bindable.
	 */
	type ImportWizardProps =
		| {
				open: boolean;
				mode: typeof WIZARD_MODE.newList;
				existingGifts?: Array<{ name: string; links: GiftLink[] }>;
				suppressNavigation?: boolean;
				onsuccess?: () => void;
		  }
		| {
				open: boolean;
				mode: typeof WIZARD_MODE.append;
				wishlistId: string;
				wishlistShortId?: string;
				wishlistTitle?: string;
				existingGifts?: Array<{ name: string; links: GiftLink[] }>;
				suppressNavigation?: boolean;
				onsuccess?: () => void;
		  };

	let {
		open = $bindable(false),
		mode,
		existingGifts = [],
		suppressNavigation = false,
		onsuccess,
		wishlistId,
		wishlistShortId,
		wishlistTitle,
	}: ImportWizardProps & {
		wishlistId?: string;
		wishlistShortId?: string;
		wishlistTitle?: string;
	} = $props();

	let currentStep = $state<WizardStep>(WIZARD_STEP.source);
	let parsedRows = $state<string[][]>([]);
	let filename = $state<string | undefined>(undefined);
	let selectedDrafts = $state<GiftDraft[]>([]);
	let reviewTitle = $state<string | undefined>(undefined);
	let commitStatus = $state<CommitStatus>(COMMIT_STATUS.idle);

	// Step index for the stepper
	const currentStepIndex = $derived(WIZARD_STEPS.indexOf(currentStep));

	// Dialog width based on step. The review step holds the table-like draft grid;
	// append mode adds a ~280px existing-items side panel, so it needs extra room.
	// NOTE: the sm: prefix is required – Dialog.Content's base class sets `sm:max-w-lg`,
	// and only a same-breakpoint `sm:` override is deduped past it by tailwind-merge.
	// Below sm the base `max-w-[calc(100%-2rem)]` keeps the dialog viewport-bound.
	const dialogWidth = $derived.by(() => {
		if (currentStep !== WIZARD_STEP.review) {
			return 'sm:max-w-[680px]';
		}
		return mode === WIZARD_MODE.append ? 'sm:max-w-[1320px]' : 'sm:max-w-[1100px]';
	});

	// Duplicate count for confirm step
	const duplicateCount = $derived.by(() => {
		if (mode !== WIZARD_MODE.append || existingGifts.length === 0) {
			return 0;
		}
		let count = 0;
		for (const draft of selectedDrafts) {
			if (findDuplicates(draft, existingGifts).length > 0) {
				count++;
			}
		}
		return count;
	});

	// Forward gate: different per step
	const canProceed = $derived.by(() => {
		if (currentStep === WIZARD_STEP.source) {
			return parsedRows.length > 0;
		}
		if (currentStep === WIZARD_STEP.review) {
			return selectedDrafts.length > 0;
		}
		return false;
	});

	function handleSourceParsed(result: { rows: string[][]; filename?: string }) {
		parsedRows = result.rows;
		filename = result.filename;
		// Auto-advance to review
		currentStep = WIZARD_STEP.review;
	}

	function handleReviewReady(data: { drafts: GiftDraft[]; title?: string }) {
		selectedDrafts = data.drafts;
		reviewTitle = data.title;
	}

	async function handleCommit(): Promise<{ shortId: string }> {
		commitStatus = COMMIT_STATUS.committing;
		try {
			if (mode === WIZARD_MODE.newList) {
				const result = await createWishlistFromImport({
					title: reviewTitle ?? 'Import',
					gifts: selectedDrafts,
				});
				commitStatus = COMMIT_STATUS.success;
				onsuccess?.();
				return { shortId: result.shortId };
			} else {
				if (wishlistId == null) {
					throw new Error('wishlistId is required in append mode');
				}
				await importGifts({
					wishlistId,
					gifts: selectedDrafts,
				});
				commitStatus = COMMIT_STATUS.success;
				onsuccess?.();
				return { shortId: wishlistShortId ?? wishlistId };
			}
		} catch {
			commitStatus = COMMIT_STATUS.error;
			throw new Error('commit failed');
		}
	}

	function handleNext() {
		if (currentStep === WIZARD_STEP.review && canProceed) {
			currentStep = WIZARD_STEP.confirm;
		}
	}

	function handleBack() {
		if (currentStep === WIZARD_STEP.confirm) {
			currentStep = WIZARD_STEP.review;
			commitStatus = COMMIT_STATUS.idle;
		} else if (currentStep === WIZARD_STEP.review) {
			currentStep = WIZARD_STEP.source;
			parsedRows = [];
			filename = undefined;
		}
	}

	function handleClose() {
		open = false;
		// Reset state on close
		currentStep = WIZARD_STEP.source;
		parsedRows = [];
		filename = undefined;
		selectedDrafts = [];
		reviewTitle = undefined;
		commitStatus = COMMIT_STATUS.idle;
	}

	function handleOpenChange(isOpen: boolean) {
		if (!isOpen) {
			handleClose();
		}
	}

	const STEP_LABELS: readonly (() => string)[] = [
		() => m.import_wizard_step_source(),
		() => m.import_wizard_step_review(),
		() => m.import_wizard_step_confirm(),
	];
</script>

<Dialog.Root {open} onOpenChange={handleOpenChange}>
	<Dialog.Content
		class="{dialogWidth} flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 transition-[max-width] duration-200"
		showCloseButton={false}
	>
		<Dialog.Title class="sr-only">{m.import_wizard_title()}</Dialog.Title>
		<Dialog.Description class="sr-only">
			{mode === WIZARD_MODE.newList
				? m.import_wizard_subtitle_new()
				: m.import_wizard_subtitle_append()}
		</Dialog.Description>

		<!-- Header: Title + Stepper -->
		<div class="flex flex-col gap-3 px-6 pt-5 pb-4">
			<div class="flex items-center justify-between">
				<h2 class="text-foreground text-lg font-semibold">
					{m.import_wizard_title()}
				</h2>
				<Dialog.Close>
					{#snippet child({ props })}
						<Button intent="ghost" size="icon-sm" {...props}>
							<XIcon />
							<span class="sr-only">{m.import_wizard_close()}</span>
						</Button>
					{/snippet}
				</Dialog.Close>
			</div>

			<!-- Stepper -->
			<div class="flex items-center gap-2">
				{#each WIZARD_STEPS as step, index (step)}
					{#if index > 0}
						<div
							class="h-px flex-1 {index <= currentStepIndex
								? 'bg-primary'
								: 'bg-border'}"
						></div>
					{/if}
					<div class="flex items-center gap-1.5">
						<div
							class="flex size-6 items-center justify-center rounded-full text-xs font-medium {index <
							currentStepIndex
								? 'bg-primary/15 text-primary'
								: index === currentStepIndex
									? 'bg-primary text-primary-foreground'
									: 'border-border text-muted-foreground border'}"
						>
							{#if index < currentStepIndex}
								<CheckIcon class="size-3.5" />
							{:else}
								{index + 1}
							{/if}
						</div>
						<span
							class="text-xs {index === currentStepIndex
								? 'text-foreground font-medium'
								: 'text-muted-foreground'}"
						>
							{STEP_LABELS[index]()}
						</span>
					</div>
				{/each}
			</div>
		</div>

		<Separator />

		<!-- Step content. Flex column so the review step's grid can fill the remaining
		     height and own the only vertical scrollbar; short steps still scroll here. -->
		<div class="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-5">
			{#if currentStep === WIZARD_STEP.source}
				<ImportSourceStep onparsed={handleSourceParsed} />
			{:else if currentStep === WIZARD_STEP.review}
				<ImportReviewStep
					{parsedRows}
					{filename}
					{mode}
					{existingGifts}
					onready={handleReviewReady}
				/>
			{:else if currentStep === WIZARD_STEP.confirm}
				<ImportConfirmStep
					{mode}
					{selectedDrafts}
					title={reviewTitle}
					{wishlistTitle}
					{duplicateCount}
					oncommit={handleCommit}
					{commitStatus}
					{suppressNavigation}
				/>
			{/if}
		</div>

		<!-- Footer -->
		{#if commitStatus !== COMMIT_STATUS.success}
			<Separator />
			<div class="flex items-center justify-between px-6 py-4">
				<div>
					{#if currentStepIndex > 0 && commitStatus !== COMMIT_STATUS.committing}
						<Button intent="ghost" onclick={handleBack}>
							<ArrowLeftIcon data-icon="inline-start" />
							{m.import_wizard_back()}
						</Button>
					{/if}
				</div>
				<div class="flex gap-2">
					{#if commitStatus !== COMMIT_STATUS.committing}
						<Button intent="ghost" onclick={handleClose}>
							{m.import_wizard_cancel()}
						</Button>
					{/if}
					{#if currentStep === WIZARD_STEP.review}
						<Button onclick={handleNext} disabled={!canProceed}>
							{m.import_wizard_next()}
						</Button>
					{/if}
				</div>
			</div>
		{/if}
	</Dialog.Content>
</Dialog.Root>
