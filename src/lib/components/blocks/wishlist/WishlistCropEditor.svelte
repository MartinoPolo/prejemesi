<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import * as ToggleGroup from '$lib/components/base/toggle-group/index.js';
	import ImageUpload from '$lib/components/derived/image-upload/ImageUpload.svelte';
	import ImageCropStage from '$lib/components/derived/image-crop/ImageCropStage.svelte';
	import { promoteOnWheel } from '$lib/components/derived/image-crop/promote_on_wheel.js';
	import ImageFrame from '$lib/components/derived/image-frame/ImageFrame.svelte';
	import {
		IMAGE_TOKEN_SCOPES,
		IMAGE_FIT_MODES,
	} from '$lib/components/derived/image-frame/index.js';
	import SlotPreviewCard from './SlotPreviewCard.svelte';
	import { toastError } from '$lib/components/base/toast/index.js';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import UploadIcon from '@lucide/svelte/icons/upload';
	import { SvelteSet } from 'svelte/reactivity';
	import { createPendingUploads } from '$lib/modules/uploads/upload.js';
	import type { UploadResult } from '$lib/modules/uploads/types.js';
	import {
		IMAGE_EDITOR_MODES,
		IMAGE_EDITOR_MODE_VALUES,
		WISHLIST_EDITOR_SLOTS,
		WISHLIST_SLOT_SPECS,
		createDefaultWishlistSlots,
		cropStateToImageMeta,
		fillImageMeta,
		fitImageMeta,
		imageMetaToFrameProps,
		seedCropRectFromLegacyMeta,
		slotEditorModeFromMeta,
		wishlistImageUrl,
		type ImageCropRect,
		type ImageEditorMode,
		type ImageMetadata,
		type WishlistEditorSlot,
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
		mode: ImageEditorMode;
		cropRect: ImageCropRect;
	}

	function initSlots(
		saved: WishlistImageSlots | null,
	): Record<WishlistEditorSlot, SlotEditState> {
		// Unset slots fall back to the shared default seed so the seeding logic lives
		// in one place (createDefaultWishlistSlots). A persisted per-slot rect restores
		// exactly; legacy focal/zoom-only rows restore their square window and the
		// stage snaps it to the slot's real aspect once the image is measured (D5).
		const defaults = createDefaultWishlistSlots();
		const result = {} as Record<WishlistEditorSlot, SlotEditState>;
		for (const slot of WISHLIST_EDITOR_SLOTS) {
			const meta = saved?.[slot] ?? defaults[slot]!;
			const cropRect = seedCropRectFromLegacyMeta(meta);
			result[slot] = { mode: slotEditorModeFromMeta(meta), cropRect };
		}
		return result;
	}

	// One-time seed from props: the editor edits a local copy and re-seeds on remount.
	// svelte-ignore state_referenced_locally
	let assignedKey = $state<string | null>(imageKey);
	// svelte-ignore state_referenced_locally
	let slotState = $state<Record<WishlistEditorSlot, SlotEditState>>(initSlots(imageSlots));
	let activeSlot = $state<WishlistEditorSlot>('card');
	// Slots edited in this session; untouched slots keep their persisted metadata
	// verbatim on save so unrelated saves never silently reframe them (#116 D5).
	const dirtySlots = new SvelteSet<WishlistEditorSlot>();

	// Uploads from this editor session that are not saved yet (issue #107, REQ-6).
	const pendingUploads = createPendingUploads();

	const imageUrl = $derived(wishlistImageUrl(assignedKey));
	const hasImage = $derived(imageUrl !== null);
	const active = $derived(slotState[activeSlot]);
	const isCropMode = $derived(active.mode === IMAGE_EDITOR_MODES.manual);

	// Bits UI's ToggleGroup.Root (type="single") mutates its own bindable `value`
	// on every click, including a re-click of the already-active item (see
	// GiftViewSwitcher.svelte for the full root-cause note). Passing `active.mode`
	// as a plain prop leaves the group uncontrolled, so that transient deselect is
	// never undone. A local `selectedEditorMode` kept in sync with `active.mode`
	// makes the rendered state always resolvable, and resetting it inside
	// setEditorMode undoes the deselect before Svelte flushes the DOM.
	// svelte-ignore state_referenced_locally (intentional one-time seed; kept in sync below)
	let selectedEditorMode = $state<ImageEditorMode>(active.mode);
	$effect(() => {
		selectedEditorMode = active.mode;
	});

	const slotLabels = {
		card: () => m.wishlist_image_slot_card(),
		thumbnail: () => m.wishlist_image_slot_thumbnail(),
		social: () => m.wishlist_image_slot_social(),
	} as const satisfies Record<WishlistEditorSlot, () => string>;

	/** The metadata a slot's editing state persists as (three-mode model). */
	function slotMetaFromState(state: SlotEditState): ImageMetadata {
		if (state.mode === IMAGE_EDITOR_MODES.manual) {
			return cropStateToImageMeta(IMAGE_FIT_MODES.coverCrop, state.cropRect);
		}
		return state.mode === IMAGE_EDITOR_MODES.fit ? fitImageMeta() : fillImageMeta();
	}

	/**
	 * The slot metadata exactly as a save would persist it: session-edited slots are
	 * rebuilt from their crop state, untouched slots (and the retained `banner` data,
	 * #116 D3/REQ-4) pass through verbatim.
	 */
	function buildSlots(): WishlistImageSlots {
		const result: WishlistImageSlots = { ...imageSlots };
		for (const slot of WISHLIST_EDITOR_SLOTS) {
			const existing: ImageMetadata | undefined = result[slot];
			if (dirtySlots.has(slot) || existing === undefined) {
				result[slot] = slotMetaFromState(slotState[slot]);
			}
		}
		return result;
	}

	/** Live preview frame for a slot – renders what a save right now would render. */
	function frameFor(slot: WishlistEditorSlot) {
		return imageMetaToFrameProps(buildSlots()[slot] ?? null);
	}

	function markDirty(slot: WishlistEditorSlot) {
		dirtySlots.add(slot);
	}

	function handleUpload(result: UploadResult) {
		assignedKey = result.objectKey;
		pendingUploads.track(result);
		// A replaced image starts from fresh centered crops; every editor slot is
		// rebuilt on save (the retained banner JSON stays untouched).
		slotState = initSlots(null);
		for (const slot of WISHLIST_EDITOR_SLOTS) {
			dirtySlots.add(slot);
		}
	}

	function handleUploadError(uploadError: Error) {
		console.error('Wishlist image upload failed:', uploadError.message);
		toastError(m.toast_wishlist_image_upload_error());
	}

	function handleRemove() {
		assignedKey = null;
		slotState = initSlots(null);
		dirtySlots.clear();
	}

	function setEditorMode(value: string) {
		if (value === '') {
			selectedEditorMode = active.mode;
			return;
		}
		if ((IMAGE_EDITOR_MODE_VALUES as string[]).includes(value)) {
			slotState[activeSlot].mode = value as ImageEditorMode;
			markDirty(activeSlot);
		}
	}

	/** A zoom attempt on the plain preview is a manual-crop intent (#116 follow-up). */
	function promoteActiveSlotToManual() {
		if (slotState[activeSlot].mode !== IMAGE_EDITOR_MODES.manual) {
			slotState[activeSlot].mode = IMAGE_EDITOR_MODES.manual;
			markDirty(activeSlot);
		}
	}

	/** Clicking a preview tile jumps to Manual mode for that slot. */
	function handleTileSelect(slot: WishlistEditorSlot) {
		activeSlot = slot;
		promoteActiveSlotToManual();
	}

	function handleSave() {
		// Storage cleanup (issue #107, REQ-6): uploads replaced before this save
		// are deleted; the saved key survives. Unsaved leftovers go on unmount.
		void pendingUploads.commit(assignedKey);
		onsave({
			imageKey: assignedKey,
			imageSlots: hasImage ? buildSlots() : null,
		});
	}

	$effect(() => {
		return () => {
			void pendingUploads.discardAll();
		};
	});
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
		<!-- WYSIWYG stage for the active slot (#116 REQ-2): the window is locked to
		     the slot's real surface aspect, so switching slots visibly reshapes it. -->
		<div class="flex flex-col gap-3">
			<Label>{slotLabels[activeSlot]()}</Label>
			{#if isCropMode}
				<ImageCropStage
					class="h-80"
					src={imageUrl!}
					alt={title}
					targetAspect={WISHLIST_SLOT_SPECS[activeSlot].aspect}
					targetLabel={slotLabels[activeSlot]()}
					realSizeText={WISHLIST_SLOT_SPECS[activeSlot].realSizeText}
					tokenScope={IMAGE_TOKEN_SCOPES.wishlist}
					bind:cropRect={slotState[activeSlot].cropRect}
					onchange={() => markDirty(activeSlot)}
				/>
			{:else}
				{@const frame = frameFor(activeSlot)}
				<!-- Wheel over the plain preview promotes to Manual so zooming "just works". -->
				<div
					class="flex justify-center"
					data-testid="image-fit-preview"
					use:promoteOnWheel={promoteActiveSlotToManual}
				>
					<!-- Absolutely positioned frame: see SlotPreviewCard (aspect-ratio
					     boxes stretch when a %-height child falls back to intrinsic size). -->
					<div
						class="relative w-full max-w-md"
						style:aspect-ratio={WISHLIST_SLOT_SPECS[activeSlot].cssAspect}
					>
						<ImageFrame
							class="absolute inset-0"
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

			<!-- Display mode (three-mode model, #116 follow-up) -->
			<div class="flex flex-col gap-2">
				<Label>{m.image_fit_label()}</Label>
				<ToggleGroup.Root
					type="single"
					bind:value={selectedEditorMode}
					onValueChange={setEditorMode}
					aria-label={m.image_fit_label()}
				>
					<ToggleGroup.Item value={IMAGE_EDITOR_MODES.fill}>
						{m.image_fit_fill()}
					</ToggleGroup.Item>
					<ToggleGroup.Item value={IMAGE_EDITOR_MODES.fit}>
						{m.image_fit_fit()}
					</ToggleGroup.Item>
					<ToggleGroup.Item value={IMAGE_EDITOR_MODES.manual}>
						{m.image_fit_manual()}
					</ToggleGroup.Item>
				</ToggleGroup.Root>
			</div>
		</div>

		<!-- Per-slot previews (REQ-7: true consumer aspects) – clicking a tile jumps
		     to Manual mode for that slot (#116 follow-up) -->
		<div class="flex flex-col gap-2">
			<span class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
				{m.wishlist_image_preview_strip_label()}
			</span>
			<ul class="grid grid-cols-3 gap-3">
				{#each WISHLIST_EDITOR_SLOTS as slot (slot)}
					<li>
						<SlotPreviewCard
							{slot}
							label={slotLabels[slot]()}
							src={imageUrl}
							frame={frameFor(slot)}
							{themeEmoji}
							active={activeSlot === slot}
							onclick={() => handleTileSelect(slot)}
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
