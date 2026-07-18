<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Dialog from '$lib/components/base/dialog/index.js';
	import * as ToggleGroup from '$lib/components/base/toggle-group/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Input } from '$lib/components/base/input/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import { Separator } from '$lib/components/base/separator/index.js';
	import { RECIPIENT_KIND, RECIPIENT_NAME_MAX_LENGTH } from '$lib/modules/wishlists/types.js';
	import type { Attachment } from 'svelte/attachments';
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
				/** Target wishlist's priority-level count; the heart column needs ≥2. */
				priorityLevelCount?: number;
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
		priorityLevelCount,
	}: ImportWizardProps & {
		wishlistId?: string;
		wishlistShortId?: string;
		wishlistTitle?: string;
		priorityLevelCount?: number;
	} = $props();

	// New-list mode always seeds the 3 default levels at commit, so priority is
	// always assignable there; append mode depends on the target wishlist's levels.
	const priorityAvailable = $derived(
		mode === WIZARD_MODE.newList || (priorityLevelCount ?? 0) >= 2,
	);

	let currentStep = $state<WizardStep>(WIZARD_STEP.source);
	let parsedRows = $state<string[][]>([]);
	let filename = $state<string | undefined>(undefined);
	let selectedDrafts = $state<GiftDraft[]>([]);
	let reviewTitle = $state<string | undefined>(undefined);
	let commitStatus = $state<CommitStatus>(COMMIT_STATUS.idle);

	// Recipient choice (new-list mode only). Typed as string to match ToggleGroup's
	// single-select value binding; comparisons against RECIPIENT_KIND narrow it.
	let recipientKind = $state<string>(RECIPIENT_KIND.self);
	let recipientName = $state('');

	// Forced-touched flag for the review step's title field (new-list mode only), set
	// when the user clicks "Next" while the title is blank so the inline error surfaces
	// even without having typed into the field first.
	let titleTouched = $state(false);

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
		return mode === WIZARD_MODE.append ? 'sm:max-w-[1400px]' : 'sm:max-w-[1180px]';
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

	// In new-list mode the "for someone else" branch requires a non-empty recipient name
	// before the wizard may advance from review to confirm (and thus to commit).
	const recipientChoiceComplete = $derived(
		mode !== WIZARD_MODE.newList ||
			recipientKind !== RECIPIENT_KIND.other ||
			recipientName.trim() !== '',
	);

	// In new-list mode a blank/whitespace-only title must never reach Confirm (it would
	// render as an empty interpolation and 400 server-side on commit). This is NOT part of
	// `canProceed`/the Next button's disabled state – a disabled button can't be clicked,
	// so it could never surface the inline title error to a user on a paste/Sheets source
	// (which starts with an empty title and no filename to derive one from). Instead Next
	// stays clickable and `handleNext` blocks + shows the field error, matching the
	// touched-on-submit-attempt pattern used by the create-wishlist dialog.
	const titleValid = $derived(mode !== WIZARD_MODE.newList || (reviewTitle ?? '').trim() !== '');

	// Forward gate: different per step
	const canProceed = $derived.by(() => {
		if (currentStep === WIZARD_STEP.source) {
			return parsedRows.length > 0;
		}
		if (currentStep === WIZARD_STEP.review) {
			return selectedDrafts.length > 0 && recipientChoiceComplete;
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
		// Defense in depth: handleNext already blocks reaching Confirm with a blank title,
		// but never silently coerce an invalid title into a fallback string (that produced
		// the empty-title "****" / generic-error-loop bug). If this is ever reached with an
		// invalid title, send the user back to the field instead of retry-looping on a 400.
		if (mode === WIZARD_MODE.newList && !titleValid) {
			currentStep = WIZARD_STEP.review;
			titleTouched = true;
			throw new Error('title is required');
		}

		commitStatus = COMMIT_STATUS.committing;
		try {
			if (mode === WIZARD_MODE.newList) {
				const commitTitle = (reviewTitle ?? '').trim();
				const trimmedRecipientName = recipientName.trim();
				const result = await createWishlistFromImport(
					recipientKind === RECIPIENT_KIND.other
						? {
								recipientKind: RECIPIENT_KIND.other,
								recipientName: trimmedRecipientName,
								title: commitTitle,
								gifts: selectedDrafts,
							}
						: {
								recipientKind: RECIPIENT_KIND.self,
								title: commitTitle,
								gifts: selectedDrafts,
							},
				);
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
		if (currentStep !== WIZARD_STEP.review) {
			return;
		}
		if (!titleValid) {
			// Surface the inline title error even if the user never typed into the field.
			titleTouched = true;
			return;
		}
		if (canProceed) {
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
			titleTouched = false;
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
		recipientKind = RECIPIENT_KIND.self;
		recipientName = '';
		titleTouched = false;
	}

	// Focus the recipient-name input the moment the "other" branch mounts.
	const autofocusOnMount: Attachment<HTMLInputElement> = (node) => {
		node.focus();
	};

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
	>
		<Dialog.Title class="sr-only">{m.import_wizard_title()}</Dialog.Title>
		<Dialog.Description class="sr-only">
			{mode === WIZARD_MODE.newList
				? m.import_wizard_subtitle_new()
				: m.import_wizard_subtitle_append()}
		</Dialog.Description>

		<!-- Header: Title + Stepper -->
		<div class="flex flex-col gap-3 px-6 pt-5 pb-4">
			<div class="flex items-center justify-between pe-12">
				<h2 class="font-heading text-lg font-semibold text-foreground">
					{m.import_wizard_title()}
				</h2>
			</div>

			<!-- Stepper: ink-bordered dots + dashed connectors (anime-sky design language) -->
			<div class="flex items-center gap-2">
				{#each WIZARD_STEPS as step, index (step)}
					{#if index > 0}
						<div
							class="flex-1 border-t-2 {index <= currentStepIndex
								? 'border-ink'
								: 'border-dashed border-ink-faint'}"
						></div>
					{/if}
					<div class="flex items-center gap-1.5">
						<div
							class="flex size-6 items-center justify-center rounded-full border-2 text-xs font-bold {index <=
							currentStepIndex
								? 'border-ink bg-primary text-primary-foreground'
								: 'border-ink-faint bg-surface text-muted-foreground'}"
						>
							{#if index < currentStepIndex}
								<CheckIcon class="size-3.5" />
							{:else}
								{index + 1}
							{/if}
						</div>
						<span
							class="text-xs {index === currentStepIndex
								? 'font-bold text-foreground'
								: 'font-semibold text-muted-foreground'}"
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
				{#if mode === WIZARD_MODE.newList}
					<div class="mb-4 flex flex-col gap-3">
						<ToggleGroup.Root
							type="single"
							intent="outline"
							value={recipientKind}
							onValueChange={(newValue) => {
								if (newValue !== '') recipientKind = newValue;
							}}
							class="w-full sm:w-fit"
						>
							<ToggleGroup.Item
								value={RECIPIENT_KIND.self}
								class="flex-1 sm:flex-none"
							>
								{m.create_for_toggle_self()}
							</ToggleGroup.Item>
							<ToggleGroup.Item
								value={RECIPIENT_KIND.other}
								class="flex-1 sm:flex-none"
							>
								{m.create_for_toggle_other()}
							</ToggleGroup.Item>
						</ToggleGroup.Root>

						{#if recipientKind === RECIPIENT_KIND.other}
							<div class="flex max-w-sm flex-col gap-2">
								<Label for="wishlist-recipient-name">
									{m.create_recipient_name_label()}
								</Label>
								<Input
									id="wishlist-recipient-name"
									bind:value={recipientName}
									placeholder={m.create_recipient_name_placeholder()}
									maxlength={RECIPIENT_NAME_MAX_LENGTH}
									required
									{@attach autofocusOnMount}
								/>
								<HelpText>
									{m.create_recipient_name_helper()}
								</HelpText>
							</div>
						{/if}
					</div>
				{/if}
				<ImportReviewStep
					{parsedRows}
					{filename}
					{mode}
					{existingGifts}
					{priorityAvailable}
					bind:titleTouched
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
