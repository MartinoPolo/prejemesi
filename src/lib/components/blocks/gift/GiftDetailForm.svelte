<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Select from '$lib/components/base/select/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Input } from '$lib/components/base/input/index.js';
	import { Textarea } from '$lib/components/base/textarea/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import { Field, type FieldControlContext } from '$lib/components/derived/field/index.js';
	import { Separator } from '$lib/components/base/separator/index.js';
	import ImageUpload from '$lib/components/derived/image-upload/ImageUpload.svelte';
	import * as ToggleGroup from '$lib/components/base/toggle-group/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import { SimpleTooltip } from '$lib/components/base/tooltip/index.js';
	import ImageFrame from '$lib/components/derived/image-frame/ImageFrame.svelte';
	import GiftImageCropCanvas from './GiftImageCropCanvas.svelte';
	import GiftImagePreviewSlots from './GiftImagePreviewSlots.svelte';
	import GiftLinkEditor from './GiftLinkEditor.svelte';
	import GiftDescription from './GiftDescription.svelte';
	import GraceCountdown from '$lib/components/derived/grace-countdown/GraceCountdown.svelte';
	import GiftIcon from '@lucide/svelte/icons/gift';
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
	import type { UploadResult } from '$lib/modules/uploads/types.js';
	import {
		IMAGE_FIT_MODES,
		IMAGE_TOKEN_SCOPES,
		type ImageFitMode,
	} from '$lib/components/derived/image-frame/index.js';
	import {
		cropStateToImageMeta,
		imageMetaToFrameProps,
		FULL_CROP_RECT,
		IMAGE_FIT_MODE_VALUES,
		type ImageCropRect,
	} from '$lib/modules/images/index.js';
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
	// svelte-ignore state_referenced_locally
	let imageMode = $state<'url' | 'upload'>((gift?.imageKey ?? '') !== '' ? 'upload' : 'url');
	let showDeleteConfirm = $state(false);
	let nameError = $state('');

	// Image presentation metadata (REQ-1/3). The crop rect is the editing representation;
	// it is converted to the renderer's focal+zoom on save and retained when switching
	// away from Crop so re-selecting it restores the region.
	// svelte-ignore state_referenced_locally
	let fitMode = $state<ImageFitMode>(gift?.imageMeta?.fitMode ?? IMAGE_FIT_MODES.auto);
	// svelte-ignore state_referenced_locally
	let cropRect = $state<ImageCropRect>({ ...(gift?.imageMeta?.cropRect ?? FULL_CROP_RECT) });
	// svelte-ignore state_referenced_locally
	const bgColor = gift?.imageMeta?.bgColor ?? null;

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
	const isCropMode = $derived(fitMode === IMAGE_FIT_MODES.coverCrop);
	const currentImageMeta = $derived(cropStateToImageMeta(fitMode, cropRect, bgColor));
	const framePreview = $derived(imageMetaToFrameProps(currentImageMeta));

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

	function handleImageUpload(result: UploadResult) {
		imageKey = result.objectKey;
		imageUrl = result.publicUrl;
	}

	function handleImageRemove() {
		imageKey = '';
		imageUrl = '';
	}

	function handleImageUploadError(uploadError: Error) {
		console.error('Image upload failed:', uploadError.message);
	}
</script>

<div class={styles.body()}>
	<!-- Left column: image stage (crop canvas in Crop mode, else live renderer preview) -->
	<div class={styles.imageColumn()}>
		{#if hasImage && previewSrc !== null && isCropMode}
			<div class="flex size-full items-center justify-center p-4">
				<GiftImageCropCanvas
					src={previewSrc}
					alt={name || m.gift_image_preview()}
					bind:cropRect
				/>
			</div>
		{:else if hasImage}
			<ImageFrame
				class="size-full"
				src={previewSrc}
				alt={name || m.gift_image_preview()}
				fitMode={framePreview.fitMode}
				focal={framePreview.focal}
				zoom={framePreview.zoom}
				fillColor={framePreview.fillColor}
				tokenScope={IMAGE_TOKEN_SCOPES.wishlist}
			/>
		{:else}
			<div class={styles.imagePlaceholder()}>
				<GiftIcon class="size-16 text-ink-faint" />
				<span class="text-sm font-semibold text-ink-soft"
					>{m.gift_image_preview_label()}</span
				>
			</div>
		{/if}
	</div>

	<!-- Right column: form -->
	<div class={styles.detailColumn()}>
		<!-- Gift grace window (issue #83): communicates temporary full-edit/delete or delete-only access. -->
		{#if graceActive && graceExpiresAt !== null}
			<div class="mb-3">
				<GraceCountdown expiresAt={graceExpiresAt} now={graceNow} message={graceMessage} />
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
										<Button size="sm" intent="ghost" onclick={cancelEditAppend}>
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
						<Select.Trigger class="w-full">
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

			<!-- Image -->
			<div class="mt-3 {styles.formField()}">
				<Label>{m.gift_image_label()}</Label>
				<div class={styles.imageTabRow()}>
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
				</div>
				{#if imageMode === 'url'}
					<Input
						bind:value={imageUrl}
						placeholder="https://example.com/image.jpg"
						type="url"
					/>
				{:else}
					<ImageUpload
						target="gift-image"
						size="small"
						initialPreviewUrl={imageUrl !== '' ? imageUrl : undefined}
						onUpload={handleImageUpload}
						onError={handleImageUploadError}
						onRemove={handleImageRemove}
					/>
				{/if}

				<!-- Fit-mode controls + live multi-slot previews appear once an image exists (REQ-1/2) -->
				{#if hasImage}
					<div class="mt-3 flex flex-col gap-2">
						<Label>{m.gift_image_fit_label()}</Label>
						<ToggleGroup.Root
							type="single"
							value={fitMode}
							onValueChange={(value: string) => {
								if (IMAGE_FIT_MODE_VALUES.includes(value as ImageFitMode)) {
									fitMode = value as ImageFitMode;
								}
							}}
							aria-label={m.gift_image_fit_label()}
						>
							<ToggleGroup.Item value={IMAGE_FIT_MODES.auto}>
								{m.gift_image_fit_auto()}
							</ToggleGroup.Item>
							<ToggleGroup.Item value={IMAGE_FIT_MODES.containPadded}>
								{m.gift_image_fit_contain()}
							</ToggleGroup.Item>
							<ToggleGroup.Item value={IMAGE_FIT_MODES.coverCrop}>
								{m.gift_image_fit_crop()}
							</ToggleGroup.Item>
						</ToggleGroup.Root>
						{#if fitMode === IMAGE_FIT_MODES.auto}
							<HelpText>{m.gift_image_fit_auto_help()}</HelpText>
						{/if}
						<GiftImagePreviewSlots
							src={previewSrc}
							alt={name || m.gift_image_preview()}
							frame={framePreview}
						/>
					</div>
				{/if}
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
					<HelpText class="w-fit rounded-md border border-border bg-surface-2 px-2 py-1">
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
									priorityLevels.find((p) => p.id === priorityLevelId)?.label ??
									''}
								{selectedLabel !== ''
									? (getPriorityDisplay(selectedLabel)?.label() ?? selectedLabel)
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
		</fieldset>

		<Separator class="my-4" />

		<!-- Actions -->
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
