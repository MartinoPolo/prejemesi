<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import { Slider } from '$lib/components/base/slider/index.js';
	import * as ToggleGroup from '$lib/components/base/toggle-group/index.js';
	import ImageUpload from '$lib/components/derived/image-upload/ImageUpload.svelte';
	import GiftImageCropCanvas from '$lib/components/blocks/gift/GiftImageCropCanvas.svelte';
	import ImageFrame from '$lib/components/derived/image-frame/ImageFrame.svelte';
	import {
		IMAGE_TOKEN_SCOPES,
		IMAGE_FIT_MODES,
		type ImageFitMode,
	} from '$lib/components/derived/image-frame/index.js';
	import SlotPreviewCard from './SlotPreviewCard.svelte';
	import { toastError } from '$lib/components/base/toast/index.js';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import UploadIcon from '@lucide/svelte/icons/upload';
	import type { UploadResult } from '$lib/modules/uploads/types.js';
	import {
		IMAGE_ZOOM_MIN,
		IMAGE_ZOOM_MAX,
		IMAGE_FIT_MODE_VALUES,
		WISHLIST_IMAGE_SLOT_VALUES,
		WISHLIST_SLOT_ASPECT,
		FULL_CROP_RECT,
		cropRectToFocalZoom,
		cropStateToImageMeta,
		focalZoomToCropRect,
		imageMetaToFrameProps,
		wishlistImageUrl,
		type ImageCropRect,
		type ImageMetadata,
		type WishlistImageSlot,
		type WishlistImageSlots,
	} from '$lib/modules/images/index.js';

	interface Props {
		/** Initial assigned image object key (null when no image yet). */
		imageKey: string | null;
		/** Initial per-slot crop metadata. */
		imageSlots: WishlistImageSlots | null;
		/** Theme-derived fallback emoji shown when no image is assigned. */
		themeEmoji: string;
		/** Wishlist title, used for accessible alt text. */
		title: string;
		isSaving?: boolean;
		onsave: (next: { imageKey: string | null; imageSlots: WishlistImageSlots | null }) => void;
	}

	let { imageKey, imageSlots, themeEmoji, title, isSaving = false, onsave }: Props = $props();

	/** Per-slot editing state: the crop rectangle is the source of truth; focal+zoom derive from it. */
	interface SlotEditState {
		fitMode: ImageFitMode;
		cropRect: ImageCropRect;
	}

	function initSlots(saved: WishlistImageSlots | null): Record<WishlistImageSlot, SlotEditState> {
		const result = {} as Record<WishlistImageSlot, SlotEditState>;
		for (const slot of WISHLIST_IMAGE_SLOT_VALUES) {
			const meta = saved?.[slot];
			if (meta === undefined) {
				result[slot] = {
					fitMode: IMAGE_FIT_MODES.coverCrop,
					cropRect: { ...FULL_CROP_RECT },
				};
				continue;
			}
			let cropRect: ImageCropRect;
			if (meta.cropRect != null) {
				cropRect = { ...meta.cropRect };
			} else if (meta.focal !== undefined && meta.zoom !== undefined) {
				cropRect = focalZoomToCropRect(meta.focal, meta.zoom);
			} else {
				cropRect = { ...FULL_CROP_RECT };
			}
			result[slot] = { fitMode: meta.fitMode, cropRect };
		}
		return result;
	}

	// One-time seed from props: the editor edits a local copy and re-seeds on remount.
	// svelte-ignore state_referenced_locally
	let assignedKey = $state<string | null>(imageKey);
	// svelte-ignore state_referenced_locally
	let slotState = $state<Record<WishlistImageSlot, SlotEditState>>(initSlots(imageSlots));
	let activeSlot = $state<WishlistImageSlot>('card');

	const imageUrl = $derived(wishlistImageUrl(assignedKey));
	const hasImage = $derived(imageUrl !== null);
	const active = $derived(slotState[activeSlot]);
	const isCropMode = $derived(active.fitMode === IMAGE_FIT_MODES.coverCrop);
	const activeZoom = $derived(cropRectToFocalZoom(active.cropRect).zoom);

	const slotLabels = {
		card: () => m.wishlist_image_slot_card(),
		thumbnail: () => m.wishlist_image_slot_thumbnail(),
		banner: () => m.wishlist_image_slot_banner(),
		social: () => m.wishlist_image_slot_social(),
	} as const satisfies Record<WishlistImageSlot, () => string>;

	function slotMeta(slot: WishlistImageSlot): ImageMetadata {
		const state = slotState[slot];
		return cropStateToImageMeta(state.fitMode, state.cropRect);
	}

	function buildSlots(): WishlistImageSlots {
		const result: WishlistImageSlots = {};
		for (const slot of WISHLIST_IMAGE_SLOT_VALUES) {
			result[slot] = slotMeta(slot);
		}
		return result;
	}

	function frameFor(slot: WishlistImageSlot) {
		return imageMetaToFrameProps(slotMeta(slot));
	}

	function handleUpload(result: UploadResult) {
		assignedKey = result.objectKey;
	}

	function handleUploadError(uploadError: Error) {
		console.error('Wishlist image upload failed:', uploadError.message);
		toastError(m.toast_wishlist_image_upload_error());
	}

	function handleRemove() {
		assignedKey = null;
		slotState = initSlots(null);
	}

	function setFitMode(value: string) {
		if (IMAGE_FIT_MODE_VALUES.includes(value as ImageFitMode)) {
			slotState[activeSlot].fitMode = value as ImageFitMode;
		}
	}

	/** Slider/wheel zoom resizes the crop around its current centre (cover-crop only). */
	function setZoom(zoom: number) {
		// focalZoomToCropRect clamps the zoom to [IMAGE_ZOOM_MIN, IMAGE_ZOOM_MAX] internally.
		const { focal } = cropRectToFocalZoom(slotState[activeSlot].cropRect);
		slotState[activeSlot].cropRect = focalZoomToCropRect(focal, zoom);
	}

	function handleZoomChange(value: number) {
		setZoom(value / 100);
	}

	function handleWheel(event: WheelEvent) {
		if (!isCropMode) {
			return;
		}
		event.preventDefault();
		const delta = event.deltaY < 0 ? 0.1 : -0.1;
		setZoom(activeZoom + delta);
	}

	// Svelte attaches inline `onwheel` as a passive listener, so `preventDefault()` would be
	// ignored and the page would scroll while zooming. Register it imperatively as non-passive.
	let cropStageEl = $state<HTMLDivElement | null>(null);
	$effect(() => {
		const el = cropStageEl;
		if (el === null) {
			return;
		}
		el.addEventListener('wheel', handleWheel, { passive: false });
		return () => el.removeEventListener('wheel', handleWheel);
	});

	function handleSave() {
		onsave({
			imageKey: assignedKey,
			imageSlots: hasImage ? buildSlots() : null,
		});
	}
</script>

<div class="flex flex-col gap-5">
	<!-- Image assignment -->
	<div class="flex flex-col gap-2">
		<Label>{m.wishlist_image_assign_label()}</Label>
		{#if !hasImage}
			<ImageUpload
				target="wishlist-banner"
				onUpload={handleUpload}
				onError={handleUploadError}
			/>
			<HelpText>{m.wishlist_image_assign_hint()}</HelpText>
		{:else}
			<div class="flex flex-wrap gap-2">
				<ImageUpload
					target="wishlist-banner"
					size="small"
					onUpload={handleUpload}
					onError={handleUploadError}
				/>
				<Button intent="outline" size="sm" onclick={handleRemove}>
					<TrashIcon data-icon="inline-start" />
					{m.wishlist_image_remove()}
				</Button>
			</div>
		{/if}
	</div>

	{#if hasImage}
		<!-- Crop stage for the active slot -->
		<div class="flex flex-col gap-3">
			<Label>{slotLabels[activeSlot]()}</Label>
			{#if isCropMode}
				<div bind:this={cropStageEl}>
					<GiftImageCropCanvas
						src={imageUrl!}
						alt={title}
						bind:cropRect={slotState[activeSlot].cropRect}
						regionLabel={m.wishlist_image_crop_region_label()}
						hint={m.wishlist_image_crop_hint()}
						resetLabel={m.wishlist_image_crop_reset()}
					/>
				</div>
			{:else}
				{@const frame = frameFor(activeSlot)}
				<div class="flex justify-center">
					<div
						class="w-full max-w-md"
						style:aspect-ratio={WISHLIST_SLOT_ASPECT[activeSlot]}
					>
						<ImageFrame
							class="size-full"
							src={imageUrl}
							alt={title}
							fitMode={frame.fitMode}
							focal={frame.focal}
							zoom={frame.zoom}
							fillColor={frame.fillColor}
							tokenScope={IMAGE_TOKEN_SCOPES.wishlist}
						/>
					</div>
				</div>
			{/if}

			<!-- Fit mode -->
			<div class="flex flex-col gap-2">
				<Label>{m.wishlist_image_fit_label()}</Label>
				<ToggleGroup.Root
					type="single"
					value={active.fitMode}
					onValueChange={setFitMode}
					aria-label={m.wishlist_image_fit_label()}
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
				{#if active.fitMode === IMAGE_FIT_MODES.auto}
					<HelpText>{m.gift_image_fit_auto_help()}</HelpText>
				{/if}
			</div>

			<!-- Zoom (cover-crop only). The Slider itself carries `disabled` for a11y;
			     a non-inherited aria-disabled on this wrapper had no effect. -->
			<div class="flex flex-col gap-2">
				<div class="flex items-center justify-between">
					<Label>{m.wishlist_image_zoom_label()}</Label>
					<span class="text-xs tabular-nums text-foreground-subtle">
						{isCropMode ? `${Math.round(activeZoom * 100)} %` : '—'}
					</span>
				</div>
				<Slider
					value={Math.round(activeZoom * 100)}
					min={IMAGE_ZOOM_MIN * 100}
					max={IMAGE_ZOOM_MAX * 100}
					step={5}
					disabled={!isCropMode}
					onValueChange={handleZoomChange}
					aria-label={m.wishlist_image_zoom_label()}
				/>
			</div>
		</div>

		<!-- Per-slot previews (REQ-2) — clicking a tile selects it for editing -->
		<div class="flex flex-col gap-2">
			<span class="text-xs font-medium tracking-wide text-foreground-subtle uppercase">
				{m.wishlist_image_preview_strip_label()}
			</span>
			<ul class="grid grid-cols-2 gap-3 sm:grid-cols-4">
				{#each WISHLIST_IMAGE_SLOT_VALUES as slot (slot)}
					<li>
						<SlotPreviewCard
							{slot}
							label={slotLabels[slot]()}
							src={imageUrl}
							frame={frameFor(slot)}
							{themeEmoji}
							active={activeSlot === slot}
							onclick={() => (activeSlot = slot)}
							class="w-full"
						/>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	<div class="flex justify-end">
		<Button data-testid="wishlist-image-save" disabled={isSaving} onclick={handleSave}>
			{#if isSaving}
				{m.saving()}
			{:else}
				<UploadIcon data-icon="inline-start" />
				{m.save()}
			{/if}
		</Button>
	</div>
</div>
