<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Select from '$lib/components/base/select/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Input } from '$lib/components/base/input/index.js';
	import { Textarea } from '$lib/components/base/textarea/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import { Separator } from '$lib/components/base/separator/index.js';
	import ImageUpload from '$lib/components/derived/image-upload/ImageUpload.svelte';
	import * as ToggleGroup from '$lib/components/base/toggle-group/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import ImageFrame from '$lib/components/derived/image-frame/ImageFrame.svelte';
	import GiftImageCropCanvas from './GiftImageCropCanvas.svelte';
	import GiftImagePreviewSlots from './GiftImagePreviewSlots.svelte';
	import * as Alert from '$lib/components/base/alert/index.js';
	import GiftLinkEditor from './GiftLinkEditor.svelte';
	import GiftIcon from '@lucide/svelte/icons/gift';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import CheckIcon from '@lucide/svelte/icons/check';
	import LinkIcon from '@lucide/svelte/icons/link';
	import UploadIcon from '@lucide/svelte/icons/upload';
	import LockIcon from '@lucide/svelte/icons/lock';
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
	import { normalizeGiftLinks } from '$lib/modules/gifts/gift_url.js';

	interface Props {
		mode: GiftDetailModalMode;
		gift: GiftByRole | null;
		wishlistId: string;
		priorityLevels: GiftPriorityLevel[];
		isOwner: boolean;
		canEdit: boolean;
		canDelete: boolean;
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
		canEdit,
		canDelete,
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
	let links = $state<GiftLink[]>(gift?.links ?? []);
	// svelte-ignore state_referenced_locally
	let price = $state(gift?.price != null ? String(gift.price) : '');
	// svelte-ignore state_referenced_locally
	let currency = $state<GiftCurrency>((gift?.currency as GiftCurrency) ?? 'CZK');
	// svelte-ignore state_referenced_locally
	let imageUrl = $state(gift?.imageUrl ?? '');
	let imageKey = $state('');
	// svelte-ignore state_referenced_locally
	let quantity = $state(String(gift?.quantity ?? 1));
	let priorityLevelId = $state('');
	let imageMode = $state<'url' | 'upload'>('url');
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

	const isEdit = $derived(mode === 'edit');
	const isEditLocked = $derived(isEdit && !canEdit);
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
			onupdate?.({
				id: gift.id,
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
				<GiftIcon class="size-16 text-muted-foreground/40" />
				<span class="text-sm font-medium text-muted-foreground/60"
					>{m.gift_image_preview_label()}</span
				>
			</div>
		{/if}
	</div>

	<!-- Right column: form -->
	<div class={styles.detailColumn()}>
		{#if isEditLocked}
			<Alert.Root tone="warning" class="mb-3">
				<LockIcon />
				<Alert.Description>{m.server_error_cannot_edit_after_sharing()}</Alert.Description>
			</Alert.Root>
		{/if}

		<!-- Editable fields are disabled once the list is shared (existing gifts) -->
		<fieldset class="contents" disabled={isEditLocked}>
			<!-- Name -->
			<div class={styles.formField()}>
				<Label for="gift-name">{m.gift_name_label()}</Label>
				<Input
					id="gift-name"
					bind:value={name}
					placeholder={m.gift_name_placeholder()}
					aria-invalid={nameError !== '' ? true : undefined}
				/>
				{#if nameError}
					<span class="text-xs text-destructive">{nameError}</span>
				{/if}
			</div>

			<!-- Description -->
			<div class="mt-3 {styles.formField()}">
				<Label for="gift-description">{m.gift_description_label()}</Label>
				<Textarea
					id="gift-description"
					bind:value={description}
					placeholder={m.gift_description_placeholder()}
					rows={3}
				/>
			</div>

			<!-- Links -->
			<div class="mt-3 {styles.formField()}">
				<GiftLinkEditor
					{links}
					disabled={isEditLocked}
					onlinkschange={(updated) => (links = updated)}
				/>
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
						onUpload={handleImageUpload}
						onError={handleImageUploadError}
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
					min="1"
					placeholder="1"
				/>
			</div>

			<!-- Priority -->
			{#if priorityLevels.length > 0}
				<div class="mt-3 {styles.formField()}">
					<Label>{m.gift_priority_label()}</Label>
					<Select.Root type="single" bind:value={priorityLevelId}>
						<Select.Trigger class="w-full">
							{#if priorityLevelId}
								{priorityLevels.find((p) => p.id === priorityLevelId)?.label ??
									m.gift_priority_select()}
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
									<Select.Item value={level.id} label={level.label}>
										{level.label}
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
			<Button
				class={styles.submitButton()}
				disabled={isSubmitting || isEditLocked}
				onclick={handleSubmit}
			>
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
