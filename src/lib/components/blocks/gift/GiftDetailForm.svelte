<script lang="ts">
	import { tick } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import * as m from '$lib/paraglide/messages.js';
	import * as Dialog from '$lib/components/base/dialog/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import { Input } from '$lib/components/base/input/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import { useNarrowViewportState } from '$lib/components/derived/narrow_viewport_state.svelte.js';
	import GraceCountdown from '$lib/components/derived/grace-countdown/GraceCountdown.svelte';
	import ReleaseReservationButton from '$lib/components/blocks/reservation/ReleaseReservationButton.svelte';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import { keepFocusOnPress } from '$lib/reactivity/keyboard_inset.svelte.js';
	import GiftImageStrip from './GiftImageStrip.svelte';
	import GiftLinkEditor from './GiftLinkEditor.svelte';
	import GiftEditorPreview from './GiftEditorPreview.svelte';
	import GiftImageFramingStep from './GiftImageFramingStep.svelte';
	import GiftNameField from './GiftNameField.svelte';
	import GiftDescriptionField from './GiftDescriptionField.svelte';
	import GiftPriceFields from './GiftPriceFields.svelte';
	import GiftQuantityPriorityFields from './GiftQuantityPriorityFields.svelte';
	import GiftCategoryField from './GiftCategoryField.svelte';
	import GiftLinkedCopiesSection from './GiftLinkedCopiesSection.svelte';
	import GiftSharedField from './GiftSharedField.svelte';
	import { canManageWishlist } from '$lib/modules/wishlists/wishlist_capabilities.js';
	import { GiftImageDraft, GiftImageGalleryDraft } from './gift_image_gallery_draft.svelte.js';
	import { giftEditorPreview } from './gift_editor_preview.js';
	import { giftFramingStatusLine } from './gift_framing_labels.js';
	import type { GiftImageStripOrientation } from './gift_image_strip_variants.js';
	import {
		giftDetailModalVariants,
		type GiftDetailModalMode,
	} from './gift_detail_modal_variants.js';
	import {
		finalizeGiftPrice,
		finalizeGiftQuantity,
		formatAppendDate,
	} from '$lib/modules/gifts/gift_display.js';
	import type {
		GiftCurrency,
		GiftByRole,
		GiftForVisitor,
		GiftLink,
		CreateGiftInput,
		UpdateGiftInput,
		GiftPriorityLevel,
	} from '$lib/modules/gifts/types.js';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';
	import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
	import { isGiftForVisitor } from '$lib/modules/gifts/gift_display_state.js';
	import { createPendingUploads } from '$lib/modules/uploads/upload.js';
	import type { UploadResult } from '$lib/modules/uploads/types.js';
	import { ensureGiftLinkIds, normalizeGiftLinks } from '$lib/modules/gifts/gift_url.js';
	import { galleryImageKeys } from '$lib/modules/gifts/gift_images.js';
	import type { ManagedGiftCategory } from '$lib/modules/gift-categories/types.js';
	import {
		giftCategoriesForIds,
		sameGiftCategoryIds,
	} from '$lib/modules/gift-categories/gift_category_assignment.js';

	type GiftSaveResult = boolean | void | Promise<boolean | void>;

	const QUANTITY_LOCK_HINT_ID = 'gift-quantity-lock-hint';
	const EDITOR_STEPS = { main: 'main', framing: 'framing' } as const;
	type EditorStep = (typeof EDITOR_STEPS)[keyof typeof EDITOR_STEPS];

	interface Props {
		mode: GiftDetailModalMode;
		gift: GiftByRole | null;
		wishlistId: string;
		demo?: boolean;
		priorityLevels: GiftPriorityLevel[];
		categoryOptions?: ManagedGiftCategory[];
		/** Offers creating a category from the category select; the gift gets it on save. */
		canCreateCategory?: boolean;
		role: WishlistRole;
		hideReservationState?: boolean;
		postShareLocked: boolean;
		/** Title of the shared linked copy whose list froze the name, when that copy froze it. */
		frozenByLinkedCopyTitle?: string | null;
		canDelete: boolean;
		/** When the active gift grace window closes (issue #83), or null when none is active. */
		graceExpiresAt?: Date | null;
		graceMessage?: (inputs: { time: string }) => string;
		/** Reactive "now" from the page clock that keeps the grace countdown live. */
		graceNow?: Date;
		/** Asked before deleting the gift or one of its description appends; false cancels it. */
		confirmChange?: () => Promise<boolean>;
		isSubmitting: boolean;
		isDeleting: boolean;
		oncreate?: (input: CreateGiftInput) => GiftSaveResult;
		onupdate?: (input: UpdateGiftInput) => GiftSaveResult;
		ondelete?: (giftId: string) => void | Promise<void>;
		oncancel?: () => void;
		ondirtychange?: (dirty: boolean) => void;
		onpendingchange?: (pending: boolean) => void;
		onsavesuccess?: () => void;
	}

	let {
		mode,
		gift,
		wishlistId,
		demo = false,
		priorityLevels,
		categoryOptions = [],
		canCreateCategory = false,
		role,
		hideReservationState = false,
		postShareLocked,
		frozenByLinkedCopyTitle = null,
		canDelete,
		graceExpiresAt = null,
		graceMessage = m.gift_grace_hint,
		graceNow = new Date(),
		confirmChange,
		isSubmitting,
		isDeleting,
		oncreate,
		onupdate,
		ondelete,
		oncancel,
		ondirtychange,
		onpendingchange,
		onsavesuccess,
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
	let price = $state<number | null>(gift?.price ?? null);
	// svelte-ignore state_referenced_locally
	let priceMax = $state<number | null>(gift?.priceMax ?? null);
	// Range mode is DERIVED on edit from `priceMax`, not its own persisted flag (issue #155 REQ-1):
	// a saved range (price_max non-null) opens the form in range mode; everything else is single-price.
	// svelte-ignore state_referenced_locally
	let isPriceRange = $state((gift?.priceMax ?? null) !== null);
	let priceRangeError = $state('');
	// svelte-ignore state_referenced_locally
	let currency = $state<GiftCurrency>((gift?.currency as GiftCurrency) ?? 'CZK');
	// Ordered images; the selected one drives the preview and the framing step (#591).
	// svelte-ignore state_referenced_locally
	const gallery = new GiftImageGalleryDraft(gift);
	const selectedImage = $derived(gallery.selected);
	// svelte-ignore state_referenced_locally
	let quantity = $state<number>(gift?.quantity ?? 1);
	// svelte-ignore state_referenced_locally
	let priorityLevelId = $state(gift?.priorityLevelId ?? '');
	// svelte-ignore state_referenced_locally
	let categoryIds = $state<string[]>([...(gift?.categoryIds ?? [])]);
	let showDeleteConfirm = $state(false);
	let nameError = $state('');
	let imageUrlInput = $state<HTMLInputElement | null>(null);
	let backButton = $state<HTMLButtonElement | null>(null);
	let bodyElement = $state<HTMLElement | null>(null);
	let isImageUploadPending = $state(false);
	let isLocalMutationPending = $state(false);
	let step = $state<EditorStep>(EDITOR_STEPS.main);

	// Uploads made in this form session that are not persisted yet (issue #107,
	// REQ-6). Successful saves commit the saved gallery's keys; every other unmount discards all.
	const pendingUploads = createPendingUploads();
	const compactViewport = useNarrowViewportState();
	const styles = giftDetailModalVariants();

	let descriptionAppendText = $state('');
	// Per-segment append edit (issue #83): the index currently being edited inline, and its draft.
	let editingAppendIndex = $state<number | null>(null);
	let editingAppendText = $state('');

	const isEdit = $derived(mode === 'edit');
	const releaseGift = $derived.by((): GiftForVisitor | null => {
		if (
			!isEdit ||
			gift === null ||
			role !== WISHLIST_ROLES.moderator ||
			!isGiftForVisitor(gift, role, hideReservationState)
		) {
			return null;
		}
		return gift;
	});
	const locked = $derived(isEdit && postShareLocked);
	// Active gift grace window: full edit after sharing, or delete-only for a new post-share gift.
	const graceActive = $derived(
		isEdit && graceExpiresAt !== null && graceNow.getTime() < graceExpiresAt.getTime(),
	);
	// Reads the local seeded `description` copy (not the `gift` prop) so the frozen/append
	// branch stays self-contained and never re-toggles from a reactive prop change.
	const descriptionFrozen = $derived(locked && description.trim() !== '');
	// Edited-after-share transparency (issue #185): the recipient/moderator edit
	// surface shows the SAME muted text line as the read-only Gift viewer.
	const editedAfterShareLine = $derived(
		gift?.editedAfterShareAt != null
			? m.gift_edited_after_share_line({
					date: formatAppendDate(gift.editedAfterShareAt.toISOString()),
				})
			: null,
	);
	const currentQuantity = $derived(gift?.quantity ?? 1);
	const submitLabel = $derived(isEdit ? m.save() : m.gift_add_title());
	const mutationPending = $derived(isSubmitting || isDeleting || isLocalMutationPending);
	const saveDisabled = $derived(mutationPending || isImageUploadPending);
	const hasDestructiveActions = $derived(
		isEdit && gift !== null && (canDelete || releaseGift !== null),
	);

	function valuesEqual(left: unknown, right: unknown): boolean {
		return JSON.stringify(left) === JSON.stringify(right);
	}

	const giftDetailsChanged = $derived(
		name.trim() !== (gift?.name ?? '').trim() ||
			(!descriptionFrozen && description.trim() !== (gift?.description ?? '').trim()) ||
			!valuesEqual(normalizeGiftLinks(links), normalizeGiftLinks(gift?.links ?? [])) ||
			priorityLevelId !== (gift?.priorityLevelId ?? '') ||
			!sameGiftCategoryIds(categoryIds, gift?.categoryIds ?? []),
	);
	const giftPriceChanged = $derived(
		finalizeGiftPrice(price) !== finalizeGiftPrice(gift?.price ?? null) ||
			isPriceRange !== ((gift?.priceMax ?? null) !== null) ||
			(isPriceRange &&
				finalizeGiftPrice(priceMax) !== finalizeGiftPrice(gift?.priceMax ?? null)) ||
			currency !== ((gift?.currency as GiftCurrency) ?? 'CZK'),
	);
	const giftQuantityChanged = $derived(
		finalizeGiftQuantity(quantity) !== finalizeGiftQuantity(gift?.quantity ?? 1),
	);
	const descriptionDraftChanged = $derived(
		descriptionAppendText.trim() !== '' ||
			(editingAppendIndex !== null &&
				editingAppendText.trim() !==
					(gift?.descriptionAppends[editingAppendIndex]?.text.trim() ?? '')),
	);
	const dirty = $derived(
		giftDetailsChanged ||
			giftPriceChanged ||
			giftQuantityChanged ||
			descriptionDraftChanged ||
			gallery.changed,
	);

	$effect(() => {
		ondirtychange?.(dirty);
	});

	const selectedImagePosition = $derived(
		selectedImage === null ? 0 : gallery.images.indexOf(selectedImage) + 1,
	);
	const selectedImageHasSource = $derived(selectedImage?.previewSrc != null);
	/** Images added by link keep their link field, so typing the first character cannot hide it. */
	const linkImageIds = new SvelteSet<string>();
	const showsImageUrlField = $derived(
		selectedImage !== null && (!selectedImageHasSource || linkImageIds.has(selectedImage.id)),
	);
	const framingOpen = $derived(step === EDITOR_STEPS.framing && selectedImageHasSource);
	const stripItems = $derived(
		gallery.images.map((image) => ({
			id: image.id,
			src: image.previewSrc,
			imageMeta: image.imageMeta,
		})),
	);
	const selectedPriorityLabel = $derived(
		priorityLevels.find((level) => level.id === priorityLevelId)?.label ?? null,
	);
	/** The visitors' view of the live values, showing the selected image first. */
	const previewGift = $derived.by(() => {
		const shownImages = selectedImage?.hasImage
			? [selectedImage, ...gallery.sourcedImages.filter((image) => image !== selectedImage)]
			: gallery.sourcedImages;
		return giftEditorPreview({
			wishlistId,
			name: name.trim() === '' ? m.gift_name_placeholder() : name,
			description: descriptionFrozen ? (gift?.description ?? null) : description || null,
			descriptionAppends: gift?.descriptionAppends ?? [],
			links: normalizeGiftLinks(links),
			price: finalizeGiftPrice(price),
			priceMax: isPriceRange ? finalizeGiftPrice(priceMax) : null,
			currency,
			quantity: finalizeGiftQuantity(quantity),
			priorityLabel: selectedPriorityLabel,
			categories: giftCategoriesForIds(categoryIds, [
				...categoryOptions,
				...(gift?.categories ?? []),
			]),
			images: shownImages.map((image) => image.toGiftImage()),
		});
	});

	function validateForm(): boolean {
		nameError = '';
		priceRangeError = '';
		if (name.trim() === '') {
			nameError = m.gift_name_required();
			return false;
		}
		if (isPriceRange) {
			const rangeMin = finalizeGiftPrice(price);
			const rangeMax = finalizeGiftPrice(priceMax);
			if (rangeMin === null || rangeMax === null) {
				priceRangeError = m.gift_price_range_required();
				return false;
			}
			if (rangeMax < rangeMin) {
				priceRangeError = m.gift_price_range_invalid();
				return false;
			}
		}
		return true;
	}

	/** Runs the footer Save from outside the form; resolves whether the gift was saved. */
	export function submit(): Promise<boolean> {
		return handleSubmit();
	}

	function buildCreateInput(): CreateGiftInput {
		return $state.snapshot({
			wishlistId,
			name: name.trim(),
			description: description.trim() || null,
			links: normalizeGiftLinks(links),
			price: finalizeGiftPrice(price),
			// price_max only persists in range mode; toggling back to single mode drops it (REQ-1).
			priceMax: isPriceRange ? finalizeGiftPrice(priceMax) : null,
			currency,
			images: gallery.toGiftImages(),
			quantity: finalizeGiftQuantity(quantity),
			priorityLevelId: priorityLevelId || null,
			categoryIds: [...categoryIds],
		});
	}

	function buildUpdateInput(giftId: string, createInput: CreateGiftInput): UpdateGiftInput {
		const editedDescription = descriptionFrozen ? descriptionAppendText : description;
		return {
			id: giftId,
			name: createInput.name,
			description: editedDescription.trim() || null,
			links: createInput.links,
			price: createInput.price,
			priceMax: createInput.priceMax,
			currency: createInput.currency,
			images: createInput.images,
			quantity: createInput.quantity,
			priorityLevelId: createInput.priorityLevelId,
			categoryIds: createInput.categoryIds,
		};
	}

	/** Hands the save to the page; `false` from it means the save was refused. */
	async function saveThroughPage(createInput: CreateGiftInput): Promise<boolean> {
		if (mode === 'create') {
			return (await oncreate?.(createInput)) !== false;
		}
		if (mode === 'edit' && gift !== null) {
			return (await onupdate?.(buildUpdateInput(gift.id, createInput))) !== false;
		}
		return false;
	}

	async function handleSubmit(): Promise<boolean> {
		if (saveDisabled) {
			return false;
		}

		if (!validateForm()) {
			// Validation messages live on the main screen.
			step = EDITOR_STEPS.main;
			return false;
		}

		const createInput = buildCreateInput();
		let saveSucceeded = false;
		isLocalMutationPending = true;
		onpendingchange?.(true);
		try {
			if (!(await saveThroughPage(createInput))) {
				return false;
			}
			await pendingUploads.commit(...galleryImageKeys(createInput.images ?? []));
			saveSucceeded = true;
		} finally {
			isLocalMutationPending = false;
			onpendingchange?.(isImageUploadPending);
		}
		if (saveSucceeded) {
			onsavesuccess?.();
		}
		return saveSucceeded;
	}

	async function saveEditAppend(index: number) {
		if (gift === null || editingAppendText.trim() === '') {
			return;
		}
		const saveResult = await onupdate?.({
			id: gift.id,
			descriptionAppendEdit: { index, text: editingAppendText.trim() },
		});
		if (saveResult !== false) {
			editingAppendIndex = null;
			editingAppendText = '';
		}
	}

	async function deleteAppend(index: number) {
		if (gift === null || !((await confirmChange?.()) ?? true)) {
			return;
		}
		onupdate?.({ id: gift.id, descriptionAppendEdit: { index, text: null } });
	}

	async function handleDelete() {
		if (mutationPending) {
			return;
		}
		if (!showDeleteConfirm) {
			showDeleteConfirm = (await confirmChange?.()) ?? true;
			return;
		}
		if (gift !== null) {
			isLocalMutationPending = true;
			onpendingchange?.(true);
			try {
				await ondelete?.(gift.id);
			} finally {
				isLocalMutationPending = false;
				onpendingchange?.(isImageUploadPending);
			}
		}
	}

	function handleStripUploadPendingChange(pending: boolean) {
		isImageUploadPending = pending;
		onpendingchange?.(isImageUploadPending || isLocalMutationPending);
	}

	/** The framing step edits only an image with a source; losing it returns to the main screen. */
	function leaveFramingWithoutSource() {
		if (step === EDITOR_STEPS.framing && !selectedImageHasSource) {
			void closeFraming();
		}
	}

	function handleStripUpload(result: UploadResult) {
		if (mutationPending) {
			return;
		}
		pendingUploads.track(result);
		gallery.add(GiftImageDraft.fromUpload(result));
	}

	/** „Vložit odkaz na obrázek“ starts an image without a source and focuses its link field. */
	async function addImageFromLink() {
		const image = new GiftImageDraft();
		if (mutationPending || !gallery.add(image)) {
			return;
		}
		linkImageIds.add(image.id);
		step = EDITOR_STEPS.main;
		await tick();
		imageUrlInput?.focus();
	}

	async function openFraming() {
		if (mutationPending || !selectedImageHasSource) {
			return;
		}
		step = EDITOR_STEPS.framing;
		await tick();
		backButton?.focus();
	}

	/**
	 * Leaves the framing step with its edits kept, returning focus to the image entry, or to the
	 * link field or the strip when the selected image has no source to frame.
	 */
	async function closeFraming() {
		step = EDITOR_STEPS.main;
		await tick();
		bodyElement?.scrollTo({ top: 0 });
		const focusTarget =
			bodyElement?.querySelector<HTMLElement>('[data-testid="gift-image-edit-entry"]') ??
			imageUrlInput ??
			bodyElement?.querySelector<HTMLElement>(
				'[data-gift-image-select][aria-pressed="true"], [data-testid="gift-image-strip-add"]',
			);
		focusTarget?.focus();
	}

	/** Escape in the framing step goes back like its Back button; returns whether it did. */
	export function leaveStepOnEscape(): boolean {
		if (!framingOpen) {
			return false;
		}
		void closeFraming();
		return true;
	}

	// The framing status line resolves legacy `auto` framings from the photo's shape, which the
	// main screen's preview does not report, so the selected photo is measured off-screen too.
	$effect(() => {
		const image = selectedImage;
		const source = image?.previewSrc ?? null;
		if (image === null || source === null || image.naturalRatio !== null) {
			return;
		}
		const probe = new Image();
		probe.onload = () => image.measure(probe.naturalWidth / probe.naturalHeight, source);
		probe.src = source;
		return () => {
			probe.onload = null;
		};
	});

	// Storage cleanup (issue #107, REQ-6): a successful save clears the tracker
	// before closing; cancellation and every other unmount delete all session uploads.
	$effect(() => {
		return () => {
			void pendingUploads.discardAll();
		};
	});
</script>

{#snippet header()}
	<Dialog.Header class={styles.header()} data-testid="gift-editor-header">
		{#if framingOpen}
			<Dialog.Back
				bind:ref={backButton}
				label={m.gift_context_back()}
				onclick={closeFraming}
			/>
			<Dialog.Title class={styles.title({ withBack: true })}>
				{m.gift_image_framing_title()}
				{selectedImagePosition}
				<span class={styles.titleCount()}>
					{m.gift_image_framing_title_count({ count: gallery.images.length })}
				</span>
			</Dialog.Title>
		{:else}
			<Dialog.Title class={styles.title({ withBack: false })}>
				{isEdit ? m.gift_edit_title() : m.gift_add_title()}
			</Dialog.Title>
		{/if}
		<Button
			class={styles.keyboardSave()}
			disabled={saveDisabled}
			data-testid="gift-editor-keyboard-save"
			onpointerdown={keepFocusOnPress}
			onclick={() => void handleSubmit()}
		>
			{isSubmitting ? m.saving() : m.save()}
		</Button>
	</Dialog.Header>
{/snippet}

{#snippet framingStatus()}
	{#if selectedImage !== null && selectedImageHasSource}
		<span data-testid="gift-image-framing-status">
			{giftFramingStatusLine(selectedImage.framings)}
		</span>
	{:else}
		{m.gift_image_strip_hint()}
	{/if}
{/snippet}

<!-- The main screen names the selected image's framings; the framing step shows them per view. -->
{#snippet strip(orientation: GiftImageStripOrientation)}
	<GiftImageStrip
		items={stripItems}
		selectedId={selectedImage?.id ?? null}
		disabled={saveDisabled}
		canAdd={!demo}
		{orientation}
		aside={orientation === 'stacked' ? framingStatus : undefined}
		onselect={(id) => {
			gallery.select(id);
			leaveFramingWithoutSource();
		}}
		onremove={(id) => {
			gallery.remove(id);
			leaveFramingWithoutSource();
		}}
		canUndoRemoval={gallery.lastRemoved !== null}
		onundoremoval={() => gallery.restoreRemoved()}
		onreorder={(orderedIds) => gallery.reorder(orderedIds)}
		onupload={handleStripUpload}
		onuploadpendingchange={handleStripUploadPendingChange}
		onaddurl={() => void addImageFromLink()}
	/>
{/snippet}

{#snippet framingStrip()}
	{@render strip('inline')}
{/snippet}

{#snippet fields()}
	<fieldset class={styles.fields()} disabled={mutationPending} data-testid="gift-detail-column">
		<!-- Gift grace window (issue #83): communicates temporary full-edit/delete or delete-only access. -->
		{#if graceActive && graceExpiresAt !== null}
			<GraceCountdown expiresAt={graceExpiresAt} now={graceNow} message={graceMessage} />
		{/if}
		<GiftNameField
			bind:name
			frozen={locked}
			frozenReason={frozenByLinkedCopyTitle === null
				? undefined
				: m.gift_name_frozen_by_linked_copy({ title: frozenByLinkedCopyTitle })}
			errorMessage={nameError}
		/>
		<GiftDescriptionField
			bind:description
			bind:appendText={descriptionAppendText}
			bind:editingAppendIndex
			bind:editingAppendText
			frozen={descriptionFrozen}
			savedDescription={gift?.description ?? ''}
			descriptionAppends={gift?.descriptionAppends ?? []}
			{graceNow}
			onsaveappend={saveEditAppend}
			ondeleteappend={deleteAppend}
		/>
		{#if editedAfterShareLine !== null}
			<p class="-mt-2 text-xs text-muted-foreground">{editedAfterShareLine}</p>
		{/if}
		<GiftLinkEditor {links} onlinkschange={(updated) => (links = updated)} />
		<div class={styles.formField()}>
			<div class={styles.formRow()} data-testid="gift-price-quantity-row">
				<GiftPriceFields
					bind:price
					bind:priceMax
					bind:isPriceRange
					bind:currency
					bind:rangeError={priceRangeError}
					fieldClass={styles.formRowField()}
					labelRowClass={styles.formLabelRow()}
				/>
				<GiftQuantityPriorityFields
					bind:quantity
					bind:priorityLevelId
					{priorityLevels}
					{locked}
					savedQuantity={currentQuantity}
					lockHintId={locked ? QUANTITY_LOCK_HINT_ID : undefined}
					fieldClass={styles.formRowField()}
					labelRowClass={styles.formLabelRow()}
				/>
			</div>
			<!-- Spans the whole row so the hint stays on one line under the narrow quantity column. -->
			{#if locked}
				<HelpText id={QUANTITY_LOCK_HINT_ID}>{m.gift_quantity_frozen_help()}</HelpText>
			{/if}
		</div>
		<GiftCategoryField
			bind:categoryIds
			{categoryOptions}
			giftCategories={gift?.categories ?? []}
			{canCreateCategory}
			{wishlistId}
		/>
		{#if isEdit && gift !== null && gift.linkedCopies.length > 0}
			<GiftLinkedCopiesSection giftId={gift.id} linkedCopies={gift.linkedCopies} />
		{/if}
		{#if isEdit && gift !== null && !demo && canManageWishlist(role)}
			<GiftSharedField {gift} />
		{/if}
	</fieldset>
{/snippet}

{#snippet rail()}
	<div class={styles.rail()} data-testid="gift-image-column">
		<GiftEditorPreview
			gift={previewGift}
			editable={selectedImageHasSource}
			disabled={mutationPending}
			onedit={() => void openFraming()}
		/>
		{#if showsImageUrlField}
			<div class={styles.formField()} data-testid="gift-image-source">
				<Label for="gift-image-url">
					{m.gift_gallery_position({
						position: selectedImagePosition,
						count: gallery.images.length,
					})} · {m.gift_image_url_label()}
				</Label>
				<Input
					id="gift-image-url"
					bind:ref={imageUrlInput}
					bind:value={
						() => selectedImage?.imageUrl ?? '',
						(imageUrl) => gallery.setSelectedImageUrl(imageUrl)
					}
					placeholder={m.draft_grid_link_url_placeholder()}
					type="url"
					disabled={mutationPending}
				/>
			</div>
		{/if}
		{@render strip('stacked')}
		{#if demo}
			<p class="text-sm text-muted-foreground">{m.demo_image_limits()}</p>
		{/if}
	</div>
{/snippet}

{#snippet destructiveActions()}
	{#if releaseGift !== null}
		<ReleaseReservationButton gift={releaseGift} disabled={mutationPending} />
	{/if}
	{#if canDelete}
		<Button
			intent="danger"
			disabled={saveDisabled}
			onclick={() => void handleDelete()}
			data-testid="gift-delete"
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
{/snippet}

{#snippet framingFooterLead()}
	<p class={styles.footerHint()}>{m.gift_image_framing_draft_hint()}</p>
{/snippet}

{#snippet saveButton()}
	<Button
		class={styles.footerPrimary()}
		disabled={saveDisabled}
		onclick={() => void handleSubmit()}
	>
		{isSubmitting ? m.saving() : submitLabel}
	</Button>
{/snippet}

{@render header()}

<Dialog.Body bind:ref={bodyElement} class={styles.body()} data-testid="gift-detail-body">
	{#if framingOpen && selectedImage !== null}
		<GiftImageFramingStep
			image={selectedImage}
			position={selectedImagePosition}
			{previewGift}
			disabled={mutationPending}
			compact={compactViewport.current}
			strip={framingStrip}
		/>
	{:else}
		<div class={styles.mainGrid()}>
			{@render fields()}
			{@render rail()}
			{#if hasDestructiveActions && compactViewport.current}
				<div class={styles.bodyActions()} data-testid="gift-body-actions">
					{@render destructiveActions()}
				</div>
			{/if}
		</div>
	{/if}
</Dialog.Body>

{#if framingOpen}
	<Dialog.Footer
		class={styles.footer()}
		lead={compactViewport.current ? undefined : framingFooterLead}
		data-testid="gift-editor-footer"
	>
		<Button intent="outline" onclick={() => void closeFraming()}>{m.done()}</Button>
		{@render saveButton()}
	</Dialog.Footer>
{:else}
	<Dialog.Footer
		class={styles.footer()}
		lead={hasDestructiveActions && !compactViewport.current ? destructiveActions : undefined}
		data-testid="gift-editor-footer"
	>
		<Button intent="outline" disabled={saveDisabled} onclick={oncancel}>{m.cancel()}</Button>
		{@render saveButton()}
	</Dialog.Footer>
{/if}
