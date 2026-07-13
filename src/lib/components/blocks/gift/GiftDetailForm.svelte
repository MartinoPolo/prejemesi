<script lang="ts">
	import { tick } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils.js';
	import * as Select from '$lib/components/base/select/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Input } from '$lib/components/base/input/index.js';
	import { Textarea } from '$lib/components/base/textarea/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import { Field, type FieldControlContext } from '$lib/components/derived/field/index.js';
	import ImageUpload from '$lib/components/derived/image-upload/ImageUpload.svelte';
	import * as ToggleGroup from '$lib/components/base/toggle-group/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import { SimpleTooltip } from '$lib/components/base/tooltip/index.js';
	import ImageFrame from '$lib/components/derived/image-frame/ImageFrame.svelte';
	import ImageCropStage from '$lib/components/derived/image-crop/ImageCropStage.svelte';
	import { promoteOnWheel } from '$lib/components/derived/image-crop/promote_on_wheel.js';
	import GiftImagePreviewSlots from './GiftImagePreviewSlots.svelte';
	import GiftLinkEditor from './GiftLinkEditor.svelte';
	import GiftDescription from './GiftDescription.svelte';
	import GraceCountdown from '$lib/components/derived/grace-countdown/GraceCountdown.svelte';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import CheckIcon from '@lucide/svelte/icons/check';
	import LinkIcon from '@lucide/svelte/icons/link';
	import UploadIcon from '@lucide/svelte/icons/upload';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import { getPriorityDisplay } from '$lib/modules/gifts/gift_display.js';
	import { isWithinGraceWindow } from '$lib/modules/sharing/grace_window.js';
	import {
		giftDetailModalVariants,
		type GiftDetailModalMode,
	} from './gift_detail_modal_variants.js';
	import {
		GIFT_CURRENCIES,
		GIFT_CURRENCY_LABELS,
		type GiftCurrency,
		type GiftByRole,
		type GiftLink,
		type CreateGiftInput,
		type UpdateGiftInput,
	} from '$lib/modules/gifts/types.js';
	import type { GiftPriorityLevel } from '$lib/modules/gifts/types.js';
	import { createPendingUploads } from '$lib/modules/uploads/upload.js';
	import type { UploadResult } from '$lib/modules/uploads/types.js';
	import {
		IMAGE_FIT_MODES,
		IMAGE_TOKEN_SCOPES,
	} from '$lib/components/derived/image-frame/index.js';
	import {
		cropRectToFocalZoom,
		fitModeForEditorMode,
		giftEditorModeFromMeta,
		giftTargetFrameProps,
		seedCropRectFromLegacyMeta,
		GIFT_CROP_TARGET_SPECS,
		GIFT_CROP_TARGET_VALUES,
		IMAGE_EDITOR_MODES,
		IMAGE_EDITOR_MODE_VALUES,
		type GiftCropTarget,
		type ImageCropRect,
		type ImageEditorMode,
		type ImageMetadata,
		type ImageTargetCrop,
	} from '$lib/modules/images/index.js';
	import { SvelteSet } from 'svelte/reactivity';
	import { ensureGiftLinkIds, normalizeGiftLinks } from '$lib/modules/gifts/gift_url.js';

	interface Props {
		mode: GiftDetailModalMode;
		gift: GiftByRole | null;
		wishlistId: string;
		priorityLevels: GiftPriorityLevel[];
		isOwner: boolean;
		postShareLocked: boolean;
		canDelete: boolean;
		/** When the active gift grace window closes (issue #83), or null when none is active. */
		graceExpiresAt?: Date | null;
		graceMessage?: (inputs: { time: string }) => string;
		/** Reactive "now" from the page clock that keeps the grace countdown live. */
		graceNow?: Date;
		isSubmitting: boolean;
		isDeleting: boolean;
		oncreate?: (input: CreateGiftInput) => void;
		onupdate?: (input: UpdateGiftInput) => void;
		ondelete?: (giftId: string) => void;
		onreceived?: (giftId: string, received: boolean) => void;
	}

	let {
		mode,
		gift,
		wishlistId,
		priorityLevels,
		isOwner,
		postShareLocked,
		canDelete,
		graceExpiresAt = null,
		graceMessage = m.gift_grace_hint,
		graceNow = new Date(),
		isSubmitting,
		isDeleting,
		oncreate,
		onupdate,
		ondelete,
		onreceived,
	}: Props = $props();

	// Intentional one-time seed from the `gift` prop: this form edits a local copy and Dialog.Content
	// unmounts on close, so the form remounts (re-seeding) each time it opens for a new gift.
	// svelte-ignore state_referenced_locally
	let name = $state(gift?.name ?? '');
	// svelte-ignore state_referenced_locally
	let description = $state(gift?.description ?? '');
	// svelte-ignore state_referenced_locally
	let links = $state<GiftLink[]>(ensureGiftLinkIds(gift?.links));
	// svelte-ignore state_referenced_locally
	let price = $state(gift?.price != null ? String(gift.price) : '');
	// svelte-ignore state_referenced_locally
	let currency = $state<GiftCurrency>((gift?.currency as GiftCurrency) ?? 'CZK');
	// svelte-ignore state_referenced_locally
	let imageUrl = $state(gift?.imageUrl ?? '');
	// svelte-ignore state_referenced_locally
	let imageKey = $state(gift?.imageKey ?? '');
	// svelte-ignore state_referenced_locally
	let quantity = $state(String(gift?.quantity ?? 1));
	// svelte-ignore state_referenced_locally
	let priorityLevelId = $state(gift?.priorityLevelId ?? '');
	// Editing an uploaded image (imageKey set) opens on the Upload tab so the user sees
	// the current image with replace/remove – not its resolved URL in the URL field.
	// Editing a URL image (imageUrl set, no imageKey) opens on the URL tab. A brand-new
	// gift (no image at all) defaults to Upload (issue #143).
	// svelte-ignore state_referenced_locally
	let imageMode = $state<'url' | 'upload'>(
		(gift?.imageKey ?? '') !== '' || (gift?.imageUrl ?? '') === '' ? 'upload' : 'url',
	);
	let showDeleteConfirm = $state(false);
	let nameError = $state('');
	// Component instance ref (issue #131): lets the image-column click-to-edit
	// affordance open the file picker owned by the Upload-tab ImageUpload.
	let imageUploadRef: ReturnType<typeof ImageUpload> | undefined = $state();

	// Uploads made in this form session that are not persisted yet (issue #107,
	// REQ-6). The image key included in the last submit is kept on unmount.
	const pendingUploads = createPendingUploads();
	let submittedImageKey: string | null = null;

	// Image presentation metadata (#116 D1/D2 + follow-up). The editor offers three
	// modes – Fill / Fit / Manual – mapped onto the persisted fitMode enum.
	// Manual crops are edited PER TARGET: each target keeps its own rect (locked to
	// the target's aspect by the stage) and only targets the user actually edits are
	// persisted – untouched targets keep the automatic framing, and legacy base
	// focal/zoom rows pass through unchanged (D5).
	// svelte-ignore state_referenced_locally
	let editorMode = $state<ImageEditorMode>(giftEditorModeFromMeta(gift?.imageMeta));
	// Whether the user touched the display mode this session; an untouched form keeps
	// the persisted (possibly legacy `auto`) fitMode verbatim on save (REQ-8).
	let modeDirty = $state(false);
	// svelte-ignore state_referenced_locally
	const bgColor = gift?.imageMeta?.bgColor ?? null;
	// svelte-ignore state_referenced_locally
	const initialImageUrl = gift?.imageUrl ?? '';
	// svelte-ignore state_referenced_locally
	const initialImageKey = gift?.imageKey ?? '';
	const hadImageInitially = initialImageUrl !== '' || initialImageKey !== '';
	// svelte-ignore state_referenced_locally
	const legacyFitMode = hadImageInitially
		? (gift?.imageMeta?.fitMode ?? IMAGE_FIT_MODES.auto)
		: null;

	function initTargetRects(meta: ImageMetadata | null | undefined) {
		const rects = {} as Record<GiftCropTarget, ImageCropRect>;
		for (const target of GIFT_CROP_TARGET_VALUES) {
			// A persisted per-target rect restores exactly; otherwise seed from the
			// base-level metadata (issue #123: a legacy row with focal/zoom but no
			// cropRect must reconstruct its real framing via seedCropRectFromLegacyMeta,
			// not silently fall back to the always-centered FULL_CROP_RECT – the stage
			// snaps this seed to the target's real aspect once the image is measured).
			const targetCrop = meta?.targets?.[target];
			rects[target] =
				targetCrop !== undefined
					? { ...targetCrop.cropRect }
					: seedCropRectFromLegacyMeta(meta ?? {});
		}
		return rects;
	}

	// svelte-ignore state_referenced_locally
	let targetRects = $state(initTargetRects(gift?.imageMeta));
	let activeTarget = $state<GiftCropTarget>('card');
	// Targets edited in this session; only these are (re)persisted on save.
	const dirtyTargets = new SvelteSet<GiftCropTarget>();

	const styles = giftDetailModalVariants();

	let descriptionAppendText = $state('');

	// Per-segment append edit (issue #83): the index currently being edited inline, and its draft.
	let editingAppendIndex = $state<number | null>(null);
	let editingAppendText = $state('');

	const isEdit = $derived(mode === 'edit');
	const locked = $derived(isEdit && postShareLocked);
	// Active gift grace window: full edit after sharing, or delete-only for a new post-share gift.
	const graceActive = $derived(
		isEdit && graceExpiresAt !== null && graceNow.getTime() < graceExpiresAt.getTime(),
	);
	// Reads the local seeded `description` copy (not the `gift` prop) so the frozen/append
	// branch stays self-contained and never re-toggles from a reactive prop change.
	const descriptionFrozen = $derived(locked && description.trim() !== '');
	const currentQuantity = $derived(gift?.quantity ?? 1);
	const submitLabel = $derived(isEdit ? m.save() : m.gift_add_title());
	const hasImage = $derived(imageUrl !== '' || imageKey !== '');

	const previewSrc = $derived(imageUrl.trim() !== '' ? imageUrl.trim() : null);
	const isCropMode = $derived(editorMode === IMAGE_EDITOR_MODES.manual);

	// A different source invalidates the persisted geometry: crops and focal points
	// target the old pixels, so a replaced image starts from the automatic framing.
	const imageReplaced = $derived(
		imageUrl.trim() !== initialImageUrl || imageKey !== initialImageKey,
	);

	// The fitMode a save would persist: legacy rows keep their stored value (incl.
	// `auto`) until the user touches the mode or replaces the image (REQ-8).
	const savedFitMode = $derived(
		modeDirty || imageReplaced || legacyFitMode === null
			? fitModeForEditorMode(editorMode)
			: legacyFitMode,
	);

	/**
	 * Persisted targets carry through a save verbatim; session edits override them.
	 * Outside Manual mode there are no manual crops: leaving Manual drops them on
	 * save (Fill/Fit own the framing), and a replaced image never
	 * inherits crops drawn for the old pixels.
	 */
	function buildTargets(): ImageMetadata['targets'] {
		if (editorMode !== IMAGE_EDITOR_MODES.manual) {
			return undefined;
		}
		const merged: Partial<Record<GiftCropTarget, ImageTargetCrop>> = imageReplaced
			? {}
			: { ...gift?.imageMeta?.targets };
		for (const target of dirtyTargets) {
			const rect = targetRects[target];
			const { focal, zoom } = cropRectToFocalZoom(rect);
			merged[target] = { cropRect: { ...rect }, focal, zoom };
		}
		return Object.keys(merged).length > 0 ? merged : undefined;
	}

	// Base focal/zoom/cropRect stay exactly as persisted for an unreplaced image so
	// legacy rows render unchanged (#116 REQ-8). Explicitly choosing Fill re-centers
	// the framing, and a replaced image starts from the automatic centered default.
	const currentImageMeta = $derived.by((): ImageMetadata => {
		const base = imageReplaced ? null : gift?.imageMeta;
		const recentered = base == null || (modeDirty && editorMode === IMAGE_EDITOR_MODES.fill);
		return {
			fitMode: savedFitMode,
			cropRect: recentered ? null : (base?.cropRect ?? null),
			focal: recentered ? { x: 50, y: 50 } : (base?.focal ?? { x: 50, y: 50 }),
			zoom: recentered ? 1 : (base?.zoom ?? 1),
			bgColor,
			targets: buildTargets(),
		};
	});

	// The image column IS the detail target surface, so it previews the detail framing.
	const detailFrame = $derived(giftTargetFrameProps(currentImageMeta, 'detail'));

	const targetLabels = {
		card: () => m.gift_image_slot_card(),
		detail: () => m.gift_image_slot_detail(),
		square: () => m.gift_image_target_square(),
	} as const satisfies Record<GiftCropTarget, () => string>;

	function setEditorMode(value: string) {
		if ((IMAGE_EDITOR_MODE_VALUES as string[]).includes(value)) {
			editorMode = value as ImageEditorMode;
			modeDirty = true;
		}
	}

	/** A zoom attempt on the plain preview is a manual-crop intent (#116 follow-up). */
	function promoteToManual() {
		if (editorMode !== IMAGE_EDITOR_MODES.manual) {
			editorMode = IMAGE_EDITOR_MODES.manual;
			modeDirty = true;
		}
	}

	/** Clicking a preview tile jumps to Manual mode with that target active. */
	function handleTileSelect(target: GiftCropTarget) {
		activeTarget = target;
		promoteToManual();
	}

	function validateForm(): boolean {
		nameError = '';
		if (name.trim() === '') {
			nameError = m.gift_name_required();
			return false;
		}
		return true;
	}

	function handleSubmit() {
		if (!validateForm()) {
			return;
		}

		const priceStr = String(price).trim();
		const quantityStr = String(quantity).trim();
		const parsedPrice = priceStr !== '' ? Number(priceStr) : null;
		const parsedQuantity = quantityStr !== '' ? Number(quantityStr) : 1;
		const normalizedLinks = normalizeGiftLinks(links);
		const imageMeta = hasImage ? currentImageMeta : null;
		submittedImageKey = imageKey || null;

		if (mode === 'create') {
			oncreate?.({
				wishlistId,
				name: name.trim(),
				description: description.trim() || null,
				links: normalizedLinks,
				price: parsedPrice,
				currency,
				imageUrl: imageUrl.trim() || null,
				imageKey: imageKey || null,
				imageMeta,
				quantity: parsedQuantity,
				priorityLevelId: priorityLevelId || null,
			});
		} else if (mode === 'edit' && gift !== null) {
			const descriptionPayload = descriptionFrozen
				? descriptionAppendText.trim() || null
				: description.trim() || null;
			onupdate?.({
				id: gift.id,
				name: name.trim(),
				description: descriptionPayload,
				links: normalizedLinks,
				price: parsedPrice,
				currency,
				imageUrl: imageUrl.trim() || null,
				imageKey: imageKey || null,
				imageMeta,
				quantity: parsedQuantity,
				priorityLevelId: priorityLevelId || null,
			});
		}
	}

	function startEditAppend(index: number, text: string) {
		editingAppendIndex = index;
		editingAppendText = text;
	}

	function cancelEditAppend() {
		editingAppendIndex = null;
		editingAppendText = '';
	}

	function saveEditAppend(index: number) {
		if (gift === null || editingAppendText.trim() === '') {
			return;
		}
		onupdate?.({
			id: gift.id,
			descriptionAppendEdit: { index, text: editingAppendText.trim() },
		});
		cancelEditAppend();
	}

	function deleteAppend(index: number) {
		if (gift !== null) {
			onupdate?.({ id: gift.id, descriptionAppendEdit: { index, text: null } });
		}
	}

	function handleDelete() {
		if (!showDeleteConfirm) {
			showDeleteConfirm = true;
			return;
		}
		if (gift !== null) {
			ondelete?.(gift.id);
		}
	}

	function handleReceived() {
		if (gift !== null) {
			onreceived?.(gift.id, !gift.received);
		}
	}

	/** A new source starts from the automatic centered Fill framing. */
	function resetCropEditing() {
		editorMode = IMAGE_EDITOR_MODES.fill;
		targetRects = initTargetRects(null);
		dirtyTargets.clear();
	}

	function handleImageUpload(result: UploadResult) {
		imageKey = result.objectKey;
		imageUrl = result.publicUrl;
		pendingUploads.track(result);
		resetCropEditing();
	}

	function handleImageRemove() {
		imageKey = '';
		imageUrl = '';
		resetCropEditing();
	}

	function handleImageUploadError(uploadError: Error) {
		console.error('Image upload failed:', uploadError.message);
	}

	/**
	 * Click-to-edit affordance for the image column (issue #131): switches the
	 * right-column image field to the Upload tab and opens the native file
	 * picker. `ImageUpload` only mounts once `imageMode` becomes `'upload'`, so
	 * the picker trigger waits a tick for it to render.
	 */
	async function openImageEditor() {
		imageMode = 'upload';
		await tick();
		imageUploadRef?.openFilePicker();
	}

	// Storage cleanup (issue #107, REQ-6): uploads that were replaced, removed,
	// or abandoned before save are deleted when the form unmounts (dialog close).
	// The submitted key survives; a pre-existing gift image is never tracked here.
	$effect(() => {
		return () => {
			void pendingUploads.commit(submittedImageKey);
		};
	});
</script>

<div class={styles.body()}>
	<!-- Left column: the display-mode control on top, then the WYSIWYG crop stage in
	     Manual mode (locked to the active target's real aspect, #116 REQ-2), else the
	     live detail-target renderer preview. The card + square + detail live previews
	     sit at the column's lower edge as clickable tiles – they double as the crop
	     target switcher (round 3) – so they cost no form space. -->
	<div
		class={cn(styles.imageColumn(), isCropMode && 'h-[400px] sm:h-auto')}
		data-testid="gift-image-column"
	>
		{#if hasImage}
			<div class="flex size-full flex-col">
				<!-- Display-mode control (#116 round 3): lives with the preview it drives. -->
				<div class="flex justify-center px-4 pt-3">
					<ToggleGroup.Root
						type="single"
						value={editorMode}
						onValueChange={setEditorMode}
						aria-label={m.image_fit_label()}
						class="rounded-full border-2 border-ink bg-card px-1.5 py-1 shadow-[3px_3px_0_var(--hard-shadow)]"
					>
						<ToggleGroup.Item value={IMAGE_EDITOR_MODES.fill} class="rounded-full">
							{m.image_fit_fill()}
						</ToggleGroup.Item>
						<ToggleGroup.Item value={IMAGE_EDITOR_MODES.fit} class="rounded-full">
							{m.image_fit_fit()}
						</ToggleGroup.Item>
						<ToggleGroup.Item value={IMAGE_EDITOR_MODES.manual} class="rounded-full">
							{m.image_fit_manual()}
						</ToggleGroup.Item>
					</ToggleGroup.Root>
				</div>
				{#if previewSrc !== null && isCropMode}
					<ImageCropStage
						class="min-h-0 flex-1 p-4 pt-2 pb-2"
						src={previewSrc}
						alt={name || m.gift_image_preview()}
						targetAspect={GIFT_CROP_TARGET_SPECS[activeTarget].aspect}
						targetLabel={targetLabels[activeTarget]()}
						realSizeText={GIFT_CROP_TARGET_SPECS[activeTarget].realSizeText}
						fillColor={bgColor}
						tokenScope={IMAGE_TOKEN_SCOPES.wishlist}
						bind:cropRect={targetRects[activeTarget]}
						onchange={() => dirtyTargets.add(activeTarget)}
					/>
					<!-- Below the stage (not overlapping: every stage pixel matters here);
					     the tiles are the only crop-target switcher (round 3). -->
					<GiftImagePreviewSlots
						class="px-4 pb-3"
						src={previewSrc}
						alt={name || m.gift_image_preview()}
						imageMeta={currentImageMeta}
						{activeTarget}
						onTileSelect={handleTileSelect}
					/>
				{:else}
					<div class="relative min-h-0 flex-1">
						<!-- Wheel over the plain preview promotes to Manual so zooming "just works". -->
						<div
							class="size-full"
							data-testid="image-fit-preview"
							use:promoteOnWheel={promoteToManual}
						>
							<ImageFrame
								class="size-full"
								src={previewSrc}
								alt={name || m.gift_image_preview()}
								fitMode={detailFrame.fitMode}
								focal={detailFrame.focal}
								zoom={detailFrame.zoom}
								fillColor={detailFrame.fillColor}
								tokenScope={IMAGE_TOKEN_SCOPES.wishlist}
							/>
						</div>
						<!-- Click-to-edit affordance (issue #131 REQ-1): overlays the preview
						     without wrapping it, so wheel-zoom-to-manual and the tile switcher
						     below stay independently interactive. -->
						<Button
							type="button"
							intent="ghost-overlay"
							size="icon-sm"
							class="absolute top-2 right-2 rounded-full bg-surface/90 shadow-sm"
							onclick={openImageEditor}
							aria-label={m.gift_image_replace_cta()}
						>
							<PencilIcon data-icon="solo" />
						</Button>
						<!-- Floating over the preview's lower edge; clicking one jumps to Manual. -->
						<GiftImagePreviewSlots
							class="absolute inset-x-0 bottom-3"
							src={previewSrc}
							alt={name || m.gift_image_preview()}
							imageMeta={currentImageMeta}
							activeTarget={null}
							onTileSelect={handleTileSelect}
						/>
					</div>
				{/if}
			</div>
		{:else}
			<!-- Empty state (issue #131 REQ-2): the whole column is an explicit
			     clickable upload placeholder, not just a preview label. -->
			<button
				type="button"
				class={styles.imagePlaceholder()}
				onclick={openImageEditor}
				aria-label={m.gift_image_upload_cta()}
			>
				<UploadIcon class="size-16 text-ink-faint" />
				<span class="text-sm font-semibold text-ink-soft">
					{m.gift_image_upload_cta()}
				</span>
				<span class="text-xs text-foreground-subtle">{m.gift_image_upload_hint()}</span>
			</button>
		{/if}
	</div>

	<!-- Right column: form fields scroll, the action buttons stay pinned below -->
	<div class={styles.detailColumn()}>
		<div class={styles.detailScroll()} data-testid="gift-form-scroll">
			<!-- Gift grace window (issue #83): communicates temporary full-edit/delete or delete-only access. -->
			{#if graceActive && graceExpiresAt !== null}
				<div class="mb-3">
					<GraceCountdown
						expiresAt={graceExpiresAt}
						now={graceNow}
						message={graceMessage}
					/>
				</div>
			{/if}
			<fieldset class="contents">
				<!-- Name -->
				<Field
					fieldId="gift-name"
					label={m.gift_name_label()}
					errorMessage={nameError}
					class={styles.formField()}
				>
					{#snippet children({ hasError, errorId }: FieldControlContext)}
						{#if locked}
							<SimpleTooltip text={m.gift_name_frozen_hint()} side="top">
								{#snippet asChild(tooltipProps)}
									<div {...tooltipProps} tabindex="-1" class="w-full">
										<Input
											id="gift-name"
											class="pointer-events-none"
											bind:value={name}
											placeholder={m.gift_name_placeholder()}
											disabled
											state={hasError ? 'error' : 'default'}
											aria-invalid={hasError ? true : undefined}
											aria-describedby={errorId}
										/>
									</div>
								{/snippet}
							</SimpleTooltip>
						{:else}
							<Input
								id="gift-name"
								bind:value={name}
								placeholder={m.gift_name_placeholder()}
								state={hasError ? 'error' : 'default'}
								aria-invalid={hasError ? true : undefined}
								aria-describedby={errorId}
							/>
						{/if}
					{/snippet}
				</Field>

				<!-- Description -->
				<div class="mt-3 {styles.formField()}">
					{#if descriptionFrozen}
						<Label>{m.gift_description_label()}</Label>
						<!-- Frozen base the gifter reserved against (read-only). -->
						{#if (gift?.description ?? '').trim() !== ''}
							<p class="text-sm whitespace-pre-line text-muted-foreground">
								{gift?.description}
							</p>
						{/if}
						<GiftDescription
							description={null}
							descriptionAppends={gift?.descriptionAppends ?? []}
							maxVisibleAppends={1}
						/>
						<!-- Recent description appends can be corrected only during their own grace window. -->
						{#each gift?.descriptionAppends ?? [] as append, index (`${append.addedAt}:${index}`)}
							{#if isWithinGraceWindow(append.addedAt, graceNow)}
								{#if editingAppendIndex === index}
									<div
										class="flex flex-col gap-2 rounded-md border border-border bg-surface-2 p-2"
									>
										<Textarea bind:value={editingAppendText} rows={2} />
										<div class="flex gap-2">
											<Button
												size="sm"
												onclick={() => saveEditAppend(index)}
												disabled={editingAppendText.trim() === ''}
											>
												{m.save()}
											</Button>
											<Button
												size="sm"
												intent="ghost"
												onclick={cancelEditAppend}
											>
												{m.cancel()}
											</Button>
										</div>
									</div>
								{:else}
									<div
										class="flex w-fit gap-1 rounded-md border border-border bg-surface-2 p-1"
									>
										<Button
											size="icon-sm"
											intent="ghost"
											aria-label={m.gift_description_append_edit_aria()}
											onclick={() => startEditAppend(index, append.text)}
										>
											<PencilIcon />
										</Button>
										<Button
											size="icon-sm"
											intent="ghost"
											aria-label={m.gift_description_append_delete_aria()}
											onclick={() => deleteAppend(index)}
										>
											<TrashIcon />
										</Button>
									</div>
								{/if}
							{/if}
						{/each}
						<Label class="mt-2">{m.gift_description_add_note_label()}</Label>
						<Textarea bind:value={descriptionAppendText} rows={2} />
						<HelpText>{m.gift_description_add_note_help()}</HelpText>
					{:else}
						<Label for="gift-description">{m.gift_description_label()}</Label>
						<Textarea
							id="gift-description"
							bind:value={description}
							placeholder={m.gift_description_placeholder()}
							rows={3}
						/>
					{/if}
				</div>

				<!-- Links -->
				<div class="mt-3 {styles.formField()}">
					<GiftLinkEditor {links} onlinkschange={(updated) => (links = updated)} />
				</div>

				<!-- Price + Currency -->
				<div class="mt-3 {styles.formRow()}">
					<div class={styles.formField()}>
						<Label for="gift-price">{m.gift_price_label()}</Label>
						<Input
							id="gift-price"
							bind:value={price}
							placeholder="0"
							type="number"
							min="0"
						/>
					</div>
					<div class={styles.formField()}>
						<Label>{m.gift_currency_label()}</Label>
						<Select.Root type="single" bind:value={currency}>
							<Select.Trigger size="sm" class="w-full">
								{GIFT_CURRENCY_LABELS[currency]}
							</Select.Trigger>
							<Select.Content>
								<Select.Group>
									{#each Object.entries(GIFT_CURRENCIES) as [key, val] (key)}
										<Select.Item value={val} label={GIFT_CURRENCY_LABELS[val]}>
											{GIFT_CURRENCY_LABELS[val]}
										</Select.Item>
									{/each}
								</Select.Group>
							</Select.Content>
						</Select.Root>
					</div>
				</div>

				<!-- Quantity -->
				<div class="mt-3 {styles.formField()}">
					<Label for="gift-quantity">{m.gift_quantity_label()}</Label>
					<Input
						id="gift-quantity"
						bind:value={quantity}
						type="number"
						min={locked ? String(currentQuantity) : '1'}
						placeholder="1"
					/>
					{#if locked}
						<HelpText
							class="w-fit rounded-md border border-border bg-surface-2 px-2 py-1"
						>
							{m.gift_quantity_frozen_help()}
						</HelpText>
					{/if}
				</div>

				<!-- Priority -->
				{#if priorityLevels.length > 0}
					<div class="mt-3 {styles.formField()}">
						<Label>{m.gift_priority_label()}</Label>
						<Select.Root type="single" bind:value={priorityLevelId}>
							<Select.Trigger class="w-full">
								{#if priorityLevelId}
									{@const selectedLabel =
										priorityLevels.find((p) => p.id === priorityLevelId)
											?.label ?? ''}
									{selectedLabel !== ''
										? (getPriorityDisplay(selectedLabel)?.label() ??
											selectedLabel)
										: m.gift_priority_select()}
								{:else}
									{m.gift_priority_none()}
								{/if}
							</Select.Trigger>
							<Select.Content>
								<Select.Group>
									<Select.Item value="" label={m.gift_priority_none()}
										>{m.gift_priority_none()}</Select.Item
									>
									{#each priorityLevels as level (level.id)}
										{@const levelLabel =
											getPriorityDisplay(level.label)?.label() ?? level.label}
										<Select.Item value={level.id} label={levelLabel}>
											{levelLabel}
										</Select.Item>
									{/each}
								</Select.Group>
							</Select.Content>
						</Select.Root>
					</div>
				{/if}

				<!-- Image (last field: source input only – the display-mode control and
			     the clickable target tiles live in the image column with the
			     preview they drive, #116 round 3) -->
				<div class="mt-3 {styles.formField()}">
					<Label>{m.gift_image_label()}</Label>
					<div class={styles.imageTabRow()}>
						<button
							type="button"
							class={giftDetailModalVariants({
								imageTabActive: imageMode === 'upload',
							}).imageTab()}
							onclick={() => (imageMode = 'upload')}
						>
							<UploadIcon class="mr-1 inline size-3" />
							{m.gift_image_upload_tab()}
						</button>
						<button
							type="button"
							class={giftDetailModalVariants({
								imageTabActive: imageMode === 'url',
							}).imageTab()}
							onclick={() => (imageMode = 'url')}
						>
							<LinkIcon class="mr-1 inline size-3" />
							URL
						</button>
					</div>
					{#if imageMode === 'url'}
						<Input
							bind:value={imageUrl}
							placeholder="https://example.com/image.jpg"
							type="url"
						/>
					{:else}
						<ImageUpload
							bind:this={imageUploadRef}
							target="gift-image"
							size="small"
							initialPreviewUrl={imageUrl !== '' ? imageUrl : undefined}
							onUpload={handleImageUpload}
							onError={handleImageUploadError}
							onRemove={handleImageRemove}
						/>
					{/if}
				</div>
			</fieldset>
		</div>

		<!-- Actions: pinned outside the scroll region so they are always visible -->
		<div class={styles.formActions()}>
			<Button class={styles.submitButton()} disabled={isSubmitting} onclick={handleSubmit}>
				{#if isSubmitting}
					{m.saving()}
				{:else}
					{submitLabel}
				{/if}
			</Button>

			{#if isEdit && gift !== null}
				{#if isOwner}
					<Button
						intent="outline"
						class={styles.receivedButton()}
						onclick={handleReceived}
					>
						<CheckIcon data-icon="inline-start" />
						{gift.received ? m.gift_mark_unreceived() : m.gift_mark_received()}
					</Button>
				{/if}

				{#if canDelete}
					<Button
						intent="danger"
						class={styles.deleteButton()}
						disabled={isDeleting}
						onclick={handleDelete}
					>
						<TrashIcon data-icon="inline-start" />
						{#if showDeleteConfirm}
							{m.gift_delete_confirm()}
						{:else if isDeleting}
							{m.deleting()}
						{:else}
							{m.gift_delete()}
						{/if}
					</Button>
				{/if}
			{/if}
		</div>
	</div>
</div>
