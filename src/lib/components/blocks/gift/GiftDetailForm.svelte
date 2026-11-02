<script lang="ts">
	import { tick } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils.js';
	import * as Select from '$lib/components/base/select/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Input } from '$lib/components/base/input/index.js';
	import { Textarea } from '$lib/components/base/textarea/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import { Switch } from '$lib/components/base/switch/index.js';
	import { Field, type FieldControlContext } from '$lib/components/derived/field/index.js';
	import ImageUpload from '$lib/components/derived/image-upload/ImageUpload.svelte';
	import * as SegmentedToggle from '$lib/components/derived/segmented-toggle/index.js';
	import * as ToggleGroup from '$lib/components/base/toggle-group/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import { SimpleTooltip } from '$lib/components/base/tooltip/index.js';
	import ImageCropStage from '$lib/components/derived/image-crop/ImageCropStage.svelte';
	import { useNarrowViewportState } from '$lib/components/derived/narrow_viewport_state.svelte.js';
	import GiftImagePreviewSlots from './GiftImagePreviewSlots.svelte';
	import GiftImageStrip from './GiftImageStrip.svelte';
	import { GiftImageDraft, GiftImageGalleryDraft } from './gift_image_gallery_draft.svelte.js';
	import GiftLinkEditor from './GiftLinkEditor.svelte';
	import GiftDescription from './GiftDescription.svelte';
	import GraceCountdown from '$lib/components/derived/grace-countdown/GraceCountdown.svelte';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import XIcon from '@lucide/svelte/icons/x';
	import LinkIcon from '@lucide/svelte/icons/link';
	import UploadIcon from '@lucide/svelte/icons/upload';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import {
		getPriorityDisplay,
		adjustGiftPriceByMagnitude,
		finalizeGiftPrice,
		finalizeGiftQuantity,
		formatAppendDate,
	} from '$lib/modules/gifts/gift_display.js';
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
		type GiftForVisitor,
		type GiftLink,
		type CreateGiftInput,
		type UpdateGiftInput,
	} from '$lib/modules/gifts/types.js';
	import type { GiftPriorityLevel } from '$lib/modules/gifts/types.js';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';
	import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
	import { isGiftForVisitor } from '$lib/modules/gifts/gift_display_state.js';
	import ReleaseReservationButton from '$lib/components/blocks/reservation/ReleaseReservationButton.svelte';
	import { createPendingUploads } from '$lib/modules/uploads/upload.js';
	import type { UploadResult } from '$lib/modules/uploads/types.js';
	import { IMAGE_TOKEN_SCOPES } from '$lib/components/derived/image-frame/index.js';
	import {
		cropTargetSurfaceSize,
		GIFT_CROP_TARGET_SPECS,
		IMAGE_EDITOR_MODES,
		IMAGE_EDITOR_MODE_VALUES,
		type GiftEditorCropTarget,
		type ImageEditorMode,
	} from '$lib/modules/images/index.js';
	import { ensureGiftLinkIds, normalizeGiftLinks } from '$lib/modules/gifts/gift_url.js';
	import { galleryImageKeys } from '$lib/modules/gifts/gift_images.js';
	import {
		labelForGiftCategory,
		type ManagedGiftCategory,
		type PublicGiftCategory,
	} from '$lib/modules/gift-categories/types.js';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import GiftCategoryQuickAddDialog from './GiftCategoryQuickAddDialog.svelte';
	import GiftCategoryBadge from './GiftCategoryBadge.svelte';
	import {
		MAX_GIFT_CATEGORIES,
		sameGiftCategoryIds,
		withGiftCategoryAdded,
		withGiftCategoryRemoved,
	} from '$lib/modules/gift-categories/gift_category_assignment.js';
	import { getLocale } from '$lib/paraglide/runtime.js';

	type GiftSaveResult = boolean | void | Promise<boolean | void>;

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
	// Switch state is DERIVED on edit from `priceMax`, not its own persisted flag (issue #155 REQ-1):
	// a saved range (price_max non-null) opens the form in range mode; everything else is single-price.
	// svelte-ignore state_referenced_locally
	let isPriceRange = $state((gift?.priceMax ?? null) !== null);
	let priceRangeError = $state('');
	let priceInput = $state<HTMLInputElement | null>(null);
	let priceMaxInput = $state<HTMLInputElement | null>(null);
	// svelte-ignore state_referenced_locally
	let currency = $state<GiftCurrency>((gift?.currency as GiftCurrency) ?? 'CZK');
	// Ordered images; the selected one drives the crop stage, mode selector and previews (#591).
	// svelte-ignore state_referenced_locally
	const gallery = new GiftImageGalleryDraft(gift);
	const selectedImage = $derived(gallery.selected);
	// svelte-ignore state_referenced_locally
	let quantity = $state<number>(gift?.quantity ?? 1);
	// svelte-ignore state_referenced_locally
	let priorityLevelId = $state(gift?.priorityLevelId ?? '');
	// svelte-ignore state_referenced_locally
	let categoryIds = $state<string[]>([...(gift?.categoryIds ?? [])]);
	/**
	 * An uploaded image (imageKey set) opens on the Upload tab so the user sees the current image
	 * with replace/remove – not its resolved URL in the URL field. A URL image opens on the URL
	 * tab, as does an image still waiting for its link; no image at all defaults to Upload
	 * (issue #143).
	 */
	function sourceTabFor(image: GiftImageDraft | null): 'url' | 'upload' {
		return image === null || image.imageKey !== '' ? 'upload' : 'url';
	}
	let imageMode = $state<'url' | 'upload'>(sourceTabFor(gallery.selected));
	let showDeleteConfirm = $state(false);
	let nameError = $state('');
	// Component instance ref (issue #131): lets the image-column click-to-edit
	// affordance open the file picker owned by the Upload-tab ImageUpload.
	let imageUploadRef: ReturnType<typeof ImageUpload> | undefined = $state();
	let imageUrlInput = $state<HTMLInputElement | null>(null);
	// Bumped when the strip changes the selection, remounting the Upload-tab field for that image.
	let sourceFieldVersion = $state(0);
	let isSourceUploadPending = $state(false);
	let isStripUploadPending = $state(false);
	const isImageUploadPending = $derived(isSourceUploadPending || isStripUploadPending);
	let isLocalMutationPending = $state(false);

	// Uploads made in this form session that are not persisted yet (issue #107,
	// REQ-6). Successful saves commit the saved gallery's keys; every other unmount discards all.
	const pendingUploads = createPendingUploads();

	const IMAGE_BACKGROUND_VALUES = ['#ffffff', '#000000', 'transparent'] as const;
	let activeTarget = $state<GiftEditorCropTarget>('square');

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
	// surface shows the SAME muted text line as the read-only Gift viewer
	// (`GiftViewer.svelte`) – only the surface changed, not who can see it
	// (REQ-5).
	const editedAfterShareLine = $derived(
		gift?.editedAfterShareAt != null
			? m.gift_edited_after_share_line({
					date: formatAppendDate(gift.editedAfterShareAt.toISOString()),
				})
			: null,
	);
	const currentQuantity = $derived(gift?.quantity ?? 1);
	const submitLabel = $derived(isEdit ? m.save() : m.gift_add_title());
	const hasImage = $derived(gallery.sourcedImages.length > 0);
	const mutationPending = $derived(isSubmitting || isDeleting || isLocalMutationPending);

	function valuesEqual(left: unknown, right: unknown): boolean {
		return JSON.stringify(left) === JSON.stringify(right);
	}

	/** Drops the thumbnail's own crop so it follows the card crop again. */
	function followSquareCrop() {
		if (mutationPending) {
			return;
		}
		selectedImage?.followSquareCrop();
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

	const previewSrc = $derived(selectedImage?.previewSrc ?? null);
	/** The selected image's 1-based gallery position, named only once there is more than one. */
	const selectedImagePosition = $derived(
		selectedImage === null || gallery.images.length < 2
			? null
			: gallery.images.indexOf(selectedImage) + 1,
	);
	const stripItems = $derived(
		gallery.images.map((image) => ({
			id: image.id,
			src: image.previewSrc,
			imageMeta: image.imageMeta,
		})),
	);
	const isCropMode = $derived(selectedImage?.editorMode === IMAGE_EDITOR_MODES.manual);

	const targetLabels = {
		square: () => m.gift_image_target_card(),
		thumb: () => m.gift_image_target_thumb(),
	} as const satisfies Record<GiftEditorCropTarget, () => string>;

	// Legacy `auto` honesty (#183 EXTRA): measuring the selected image lets its presented mode
	// match the real card/list render without dirtying the form (see `GiftImageDraft`).
	$effect(() => {
		const image = selectedImage;
		const src = image?.previewSrc ?? null;
		if (image === null || src === null) {
			return;
		}
		let cancelled = false;
		const probe = new Image();
		probe.onload = () => {
			if (!cancelled && probe.naturalWidth > 0 && probe.naturalHeight > 0) {
				image.measuredNaturalRatio = probe.naturalWidth / probe.naturalHeight;
			}
		};
		probe.src = src;
		return () => {
			cancelled = true;
		};
	});

	const presentedEditorMode = $derived(
		selectedImage?.presentedEditorMode ?? IMAGE_EDITOR_MODES.fill,
	);
	const selectedImageBackground = $derived(selectedImage?.bgColor ?? null);

	// Bits UI's ToggleGroup.Root (type="single") mutates its own bindable `value`
	// on every click, including a re-click of the already-active item (see
	// GiftViewSwitcher.svelte for the full root-cause note). Passing
	// `presentedEditorMode` as a plain prop leaves the group uncontrolled, so that
	// transient deselect is never undone. A writable `$derived` local, kept in
	// sync with `presentedEditorMode` automatically, makes the rendered state
	// always resolvable, and resetting it inside setEditorMode undoes the
	// deselect. That reset always overwrites a value the two-way binding just set
	// to "" (Bits UI writes through the bound value before calling onValueChange),
	// so it's a genuine change and always re-renders.
	let selectedEditorMode = $derived(presentedEditorMode);
	// The visible Transparent option represents the canonical null fallback. Preserve an
	// unsupported historical literal untouched rather than falsely selecting a known fill.
	let selectedBgColor = $derived(
		selectedImageBackground === null
			? 'transparent'
			: (IMAGE_BACKGROUND_VALUES as readonly string[]).includes(selectedImageBackground)
				? selectedImageBackground
				: '',
	);

	// The crop window is drawn at the target's real size on this device class (#533).
	const compactViewport = useNarrowViewportState();
	const activeSurfaceSize = $derived(
		cropTargetSurfaceSize(GIFT_CROP_TARGET_SPECS[activeTarget], compactViewport.current),
	);
	// The mobile List row shows only a centered slice of the square thumbnail.
	const activeVisibleWidthFraction = $derived(
		compactViewport.current && activeTarget === 'thumb'
			? GIFT_CROP_TARGET_SPECS.thumb.compactVisibleWidthFraction
			: null,
	);

	$effect(() => {
		selectedImage?.syncFollowedThumbnail();
	});

	function setEditorMode(value: string) {
		if (mutationPending || value === '' || selectedImage === null) {
			selectedEditorMode = presentedEditorMode;
			return;
		}
		if ((IMAGE_EDITOR_MODE_VALUES as string[]).includes(value)) {
			selectedImage.chooseEditorMode(value as ImageEditorMode, activeTarget);
		}
	}

	function setBgColor(value: string) {
		if (mutationPending || value === '' || selectedImage === null) {
			selectedBgColor = selectedImageBackground ?? 'transparent';
			return;
		}
		if (value === 'transparent' || value === '#ffffff' || value === '#000000') {
			selectedImage.chooseBackground(value);
		}
	}

	/** Clicking a preview tile only picks the edited target; editing it promotes. */
	function handleTileSelect(target: GiftEditorCropTarget) {
		if (mutationPending) {
			return;
		}
		activeTarget = target;
	}

	function adjustGiftPrice(
		currentPrice: number | null,
		direction: 1 | -1,
		setPrice: (value: number) => void,
	): void {
		setPrice(adjustGiftPriceByMagnitude(currentPrice, direction));
	}

	function handleGiftPriceKeydown(
		event: KeyboardEvent,
		currentPrice: number | null,
		setPrice: (value: number) => void,
	): void {
		if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
			return;
		}
		event.preventDefault();
		adjustGiftPrice(currentPrice, event.key === 'ArrowUp' ? 1 : -1, setPrice);
	}

	interface GiftPriceWheelOptions {
		getPrice: () => number | null;
		setPrice: (value: number) => void;
	}

	// Svelte attaches inline `onwheel` as a passive listener, so `preventDefault()`
	// would be ignored and the dialog would scroll while changing price. Register non-passive.
	function giftPriceWheel(node: HTMLInputElement, options: GiftPriceWheelOptions) {
		const listener = (event: WheelEvent) => {
			if (node !== document.activeElement || event.deltaY === 0) {
				return;
			}
			event.preventDefault();
			adjustGiftPrice(options.getPrice(), event.deltaY < 0 ? 1 : -1, options.setPrice);
		};
		node.addEventListener('wheel', listener, { passive: false });
		return () => node.removeEventListener('wheel', listener);
	}

	$effect(() => {
		if (priceInput !== null) {
			return giftPriceWheel(priceInput, {
				getPrice: () => price,
				setPrice: (value) => (price = value),
			});
		}
	});

	$effect(() => {
		if (priceMaxInput !== null) {
			return giftPriceWheel(priceMaxInput, {
				getPrice: () => priceMax,
				setPrice: (value) => (priceMax = value),
			});
		}
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

	/** The editor's title-row Save, shown while the on-screen keyboard hides the footer. */
	export function submit() {
		void handleSubmit();
	}

	async function handleSubmit() {
		if (mutationPending || isImageUploadPending) {
			return;
		}

		if (!validateForm()) {
			return;
		}

		const finalPrice = finalizeGiftPrice(price);
		// price_max only persists in range mode; toggling back to single mode drops it (REQ-1).
		const finalPriceMax = isPriceRange ? finalizeGiftPrice(priceMax) : null;
		const finalQuantity = finalizeGiftQuantity(quantity);
		const normalizedLinks = normalizeGiftLinks(links);
		const images = gallery.toGiftImages();
		const descriptionPayload = descriptionFrozen
			? descriptionAppendText.trim() || null
			: description.trim() || null;
		const createInput = $state.snapshot({
			wishlistId,
			name: name.trim(),
			description: description.trim() || null,
			links: normalizedLinks,
			price: finalPrice,
			priceMax: finalPriceMax,
			currency,
			images,
			quantity: finalQuantity,
			priorityLevelId: priorityLevelId || null,
			categoryIds: [...categoryIds],
		}) satisfies CreateGiftInput;
		const updateInput =
			gift === null
				? null
				: ($state.snapshot({
						id: gift.id,
						name: createInput.name,
						description: descriptionPayload,
						links: createInput.links,
						price: createInput.price,
						priceMax: createInput.priceMax,
						currency: createInput.currency,
						images: createInput.images,
						quantity: createInput.quantity,
						priorityLevelId: createInput.priorityLevelId,
						categoryIds: createInput.categoryIds,
					}) satisfies UpdateGiftInput);
		let saveSucceeded = false;
		isLocalMutationPending = true;
		onpendingchange?.(true);
		try {
			let saveResult: boolean | void;
			if (mode === 'create') {
				saveResult = await oncreate?.(createInput);
			} else if (mode === 'edit' && updateInput !== null) {
				saveResult = await onupdate?.(updateInput);
			} else {
				return;
			}
			if (saveResult === false) {
				return;
			}
			await pendingUploads.commit(...galleryImageKeys(images));
			saveSucceeded = true;
		} finally {
			isLocalMutationPending = false;
			onpendingchange?.(isImageUploadPending);
		}
		if (saveSucceeded) {
			onsavesuccess?.();
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

	async function saveEditAppend(index: number) {
		if (gift === null || editingAppendText.trim() === '') {
			return;
		}
		const saveResult = await onupdate?.({
			id: gift.id,
			descriptionAppendEdit: { index, text: editingAppendText.trim() },
		});
		if (saveResult !== false) {
			cancelEditAppend();
		}
	}

	async function deleteAppend(index: number) {
		if (gift === null || !((await confirmChange?.()) ?? true)) {
			return;
		}
		onupdate?.({ id: gift.id, descriptionAppendEdit: { index, text: null } });
	}

	function categoryLabel(category: PublicGiftCategory): string {
		return labelForGiftCategory(category, getLocale().startsWith('en') ? 'en' : 'cs');
	}

	const CREATE_CATEGORY_VALUE = '__create-category__';
	let categoryQuickAddOpen = $state(false);
	let categorySelectOpen = $state(false);
	// Shown until the refreshed category list that includes it arrives.
	let createdCategory = $state<PublicGiftCategory | null>(null);
	const categorySelectOptions = $derived<readonly PublicGiftCategory[]>(
		createdCategory === null ||
			categoryOptions.some((category) => category.id === createdCategory?.id)
			? categoryOptions
			: [...categoryOptions, createdCategory],
	);

	const selectedCategories = $derived(
		categoryIds.flatMap((id) => {
			const category = [...categorySelectOptions, ...(gift?.categories ?? [])].find(
				(option) => option.id === id,
			);
			return category === undefined ? [] : [category];
		}),
	);
	const isAtCategoryLimit = $derived(categoryIds.length >= MAX_GIFT_CATEGORIES);

	/** Keeps the chosen order: kept categories stay in place and new ones join at the end. */
	function chooseCategories(values: string[]) {
		if (values.includes(CREATE_CATEGORY_VALUE)) {
			categorySelectOpen = false;
			categoryQuickAddOpen = true;
			return;
		}
		categoryIds = [
			...categoryIds.filter((id) => values.includes(id)),
			...values.filter((id) => !categoryIds.includes(id)),
		].slice(0, MAX_GIFT_CATEGORIES);
	}

	let categoryChipList = $state<HTMLElement | null>(null);

	/** The pressed chip button disappears or moves, so keep keyboard focus on the chip list. */
	async function focusCategoryChipButton(categoryId: string | undefined) {
		await tick();
		const chipButtons = categoryChipList?.querySelector<HTMLElement>(
			`[data-category-chip="${categoryId}"] button`,
		);
		(
			chipButtons ??
			document.querySelector<HTMLElement>('[data-testid="gift-category-select"]')
		)?.focus();
	}

	function removeCategory(id: string) {
		const index = categoryIds.indexOf(id);
		categoryIds = withGiftCategoryRemoved(categoryIds, id);
		void focusCategoryChipButton(categoryIds[index] ?? categoryIds[index - 1]);
	}

	function moveCategoryEarlier(index: number) {
		const reordered = [...categoryIds];
		[reordered[index - 1], reordered[index]] = [reordered[index]!, reordered[index - 1]!];
		categoryIds = reordered;
		void focusCategoryChipButton(reordered[index - 1]);
	}

	function selectCreatedCategory(category: PublicGiftCategory) {
		createdCategory = category;
		categoryIds = withGiftCategoryAdded(categoryIds, category.id);
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

	/** The source field edits the selected image; a gift without images starts its first one. */
	function handleImageUpload(result: UploadResult) {
		if (mutationPending) {
			return;
		}
		pendingUploads.track(result);
		gallery.useUploadForSelected(result);
	}

	function handleImageRemove() {
		if (mutationPending || selectedImage === null) {
			return;
		}
		removeGalleryImage(selectedImage.id);
	}

	function handleImageUrlInput(imageUrl: string) {
		if (mutationPending) {
			return;
		}
		gallery.setSelectedImageUrl(imageUrl);
	}

	function handleImageUploadError(uploadError: Error) {
		console.error('Image upload failed:', uploadError.message);
	}

	function handleImageUploadPendingChange(pending: boolean) {
		isSourceUploadPending = pending;
		onpendingchange?.(isImageUploadPending || isLocalMutationPending);
	}

	function handleStripUploadPendingChange(pending: boolean) {
		isStripUploadPending = pending;
		onpendingchange?.(isImageUploadPending || isLocalMutationPending);
	}

	/** After the strip changes the selection, the source field shows the newly selected image. */
	function showSelectedImageSource(tab: 'url' | 'upload' = sourceTabFor(gallery.selected)) {
		imageMode = tab;
		sourceFieldVersion += 1;
	}

	function selectGalleryImage(id: string) {
		gallery.select(id);
		showSelectedImageSource();
	}

	function removeGalleryImage(id: string) {
		gallery.remove(id);
		showSelectedImageSource();
	}

	function handleStripUpload(result: UploadResult) {
		if (mutationPending) {
			return;
		}
		pendingUploads.track(result);
		if (gallery.add(GiftImageDraft.fromUpload(result))) {
			showSelectedImageSource('upload');
		}
	}

	/** „Vložit odkaz na obrázek“ starts an image without a source and focuses its link field. */
	async function addImageFromLink() {
		if (mutationPending || !gallery.add(new GiftImageDraft())) {
			return;
		}
		showSelectedImageSource('url');
		await tick();
		imageUrlInput?.focus();
	}

	/**
	 * Click-to-edit affordance for the image column (issue #131): switches the
	 * right-column image field to the Upload tab and opens the native file
	 * picker. `ImageUpload` only mounts once `imageMode` becomes `'upload'`, so
	 * the picker trigger waits a tick for it to render.
	 */
	async function openImageEditor() {
		if (demo || mutationPending || isImageUploadPending) {
			return;
		}
		imageMode = 'upload';
		await tick();
		imageUploadRef?.openFilePicker();
	}

	// Storage cleanup (issue #107, REQ-6): a successful save clears the tracker
	// before closing; cancellation and every other unmount delete all session uploads.
	$effect(() => {
		return () => {
			void pendingUploads.discardAll();
		};
	});
</script>

{#snippet submitActions()}
	<Button
		class={styles.submitButton()}
		disabled={mutationPending || isImageUploadPending}
		onclick={() => void handleSubmit()}
	>
		{#if isSubmitting}
			{m.saving()}
		{:else}
			{submitLabel}
		{/if}
	</Button>
	<Button
		intent="outline"
		class={styles.submitButton()}
		disabled={mutationPending || isImageUploadPending}
		onclick={oncancel}
	>
		{m.cancel()}
	</Button>
{/snippet}

<div class={styles.body()} data-testid="gift-detail-body">
	<!-- Fields are first in DOM order; desktop places this primary column on the right. -->
	<div class={styles.detailColumn()} data-testid="gift-detail-column">
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
			<fieldset class="contents" disabled={mutationPending}>
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
										<div class="flex gap-(--nested-control-gap)">
											<Button
												size="sm"
												onclick={() => void saveEditAppend(index)}
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
											size="sm"
											format="icon"
											intent="ghost"
											aria-label={m.gift_description_append_edit_aria()}
											onclick={() => startEditAppend(index, append.text)}
										>
											<PencilIcon />
										</Button>
										<Button
											size="sm"
											format="icon"
											intent="ghost"
											aria-label={m.gift_description_append_delete_aria()}
											onclick={() => void deleteAppend(index)}
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

				{#if editedAfterShareLine !== null}
					<p class="mt-2 text-xs text-muted-foreground">{editedAfterShareLine}</p>
				{/if}

				<!-- Links -->
				<div class="mt-3 {styles.formField()}">
					<GiftLinkEditor {links} onlinkschange={(updated) => (links = updated)} />
				</div>

				<!-- Price + Currency -->
				<div class="mt-3 {styles.formRow()}" data-testid="gift-price-currency-row">
					<div class={styles.formRowField()}>
						<div data-slot="gift-form-label-row" class={styles.formLabelRow()}>
							<Label for="gift-price">{m.gift_price_label()}</Label>
							<div class="flex items-center gap-1.5">
								<Label
									for="gift-price-range-switch"
									class="text-xs font-normal text-muted-foreground"
								>
									{m.gift_price_range_toggle_label()}
								</Label>
								<Switch
									id="gift-price-range-switch"
									size="sm"
									bind:checked={isPriceRange}
									onCheckedChange={() => (priceRangeError = '')}
								/>
							</div>
						</div>
						<div class={styles.formControlStack()}>
							{#if isPriceRange}
								<div class="flex items-center gap-2">
									<Input
										id="gift-price"
										class="numeric-input min-w-0"
										bind:value={price}
										placeholder="0"
										type="number"
										min="0"
										step="0.01"
										onkeydown={(event) =>
											handleGiftPriceKeydown(
												event,
												price,
												(value) => (price = value),
											)}
										bind:ref={priceInput}
										aria-label={m.gift_price_range_min_aria()}
										state={priceRangeError !== '' ? 'error' : 'default'}
										aria-invalid={priceRangeError !== '' ? true : undefined}
										aria-describedby={priceRangeError !== ''
											? 'gift-price-range-error'
											: undefined}
									/>
									<span class="shrink-0 text-muted-foreground" aria-hidden="true"
										>–</span
									>
									<Input
										id="gift-price-max"
										class="numeric-input min-w-0"
										bind:value={priceMax}
										placeholder="0"
										type="number"
										min="0"
										step="0.01"
										onkeydown={(event) =>
											handleGiftPriceKeydown(
												event,
												priceMax,
												(value) => (priceMax = value),
											)}
										bind:ref={priceMaxInput}
										aria-label={m.gift_price_range_max_aria()}
										state={priceRangeError !== '' ? 'error' : 'default'}
										aria-invalid={priceRangeError !== '' ? true : undefined}
										aria-describedby={priceRangeError !== ''
											? 'gift-price-range-error'
											: undefined}
									/>
								</div>
							{:else}
								<Input
									id="gift-price"
									class="numeric-input"
									bind:value={price}
									placeholder="0"
									type="number"
									min="0"
									step="0.01"
									onkeydown={(event) =>
										handleGiftPriceKeydown(
											event,
											price,
											(value) => (price = value),
										)}
									bind:ref={priceInput}
								/>
							{/if}
							{#if priceRangeError !== ''}
								<HelpText id="gift-price-range-error" state="error"
									>{priceRangeError}</HelpText
								>
							{/if}
						</div>
					</div>
					<div class={styles.formRowField()}>
						<div data-slot="gift-form-label-row" class={styles.formLabelRow()}>
							<Label>{m.gift_currency_label()}</Label>
						</div>
						<div class={styles.formControlStack()}>
							<Select.Root type="single" bind:value={currency}>
								<Select.Trigger class="w-full">
									{GIFT_CURRENCY_LABELS[currency]}
								</Select.Trigger>
								<Select.Content>
									<Select.Group>
										{#each Object.entries(GIFT_CURRENCIES) as [key, val] (key)}
											<Select.Item
												value={val}
												label={GIFT_CURRENCY_LABELS[val]}
											>
												{GIFT_CURRENCY_LABELS[val]}
											</Select.Item>
										{/each}
									</Select.Group>
								</Select.Content>
							</Select.Root>
						</div>
					</div>
				</div>

				<!-- Quantity + category + priority -->
				<div class={cn('mt-3', styles.formRow())} data-testid="gift-quantity-priority-row">
					<div class={styles.formRowField()}>
						<div data-slot="gift-form-label-row" class={styles.formLabelRow()}>
							<Label for="gift-quantity">{m.gift_quantity_label()}</Label>
						</div>
						<div class={styles.formControlStack()}>
							<Input
								id="gift-quantity"
								class="numeric-input"
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
					</div>

					<div class={styles.formRowField()}>
						<div data-slot="gift-form-label-row" class={styles.formLabelRow()}>
							<Label>{m.gift_category_label()}</Label>
						</div>
						<div class={styles.formControlStack()}>
							{#if categorySelectOptions.length > 0 || canCreateCategory}
								<Select.Root
									type="multiple"
									bind:open={categorySelectOpen}
									bind:value={() => categoryIds, chooseCategories}
								>
									<Select.Trigger
										class="w-full"
										data-testid="gift-category-select"
									>
										<span class="truncate">
											{selectedCategories.length === 0
												? m.gift_category_none()
												: selectedCategories.map(categoryLabel).join(', ')}
										</span>
									</Select.Trigger>
									<Select.Content>
										<Select.Group>
											{#each categorySelectOptions as category (category.id)}
												{@const label = categoryLabel(category)}
												<Select.Item
													value={category.id}
													{label}
													indicator="checkbox"
													disabled={isAtCategoryLimit &&
														!categoryIds.includes(category.id)}
													><span
														class="size-3 shrink-0 rounded-full border border-ink"
														style:background-color={category.color}
														aria-hidden="true"
													></span>{label}</Select.Item
												>
											{/each}
										</Select.Group>
										{#if canCreateCategory}
											<Select.Separator />
											<Select.Item
												value={CREATE_CATEGORY_VALUE}
												label={m.gift_category_create()}
												disabled={isAtCategoryLimit}
												data-testid="gift-category-create-option"
												><PlusIcon />{m.gift_category_create()}</Select.Item
											>
										{/if}
									</Select.Content>
								</Select.Root>
								{#if selectedCategories.length > 0}
									<ul
										class="flex flex-wrap gap-1.5"
										aria-label={m.gift_category_label()}
										bind:this={categoryChipList}
										data-testid="gift-category-chips"
									>
										{#each selectedCategories as category, index (category.id)}
											{@const label = categoryLabel(category)}
											<li
												class="inline-flex min-w-0 items-center gap-0.5"
												data-category-chip={category.id}
											>
												<GiftCategoryBadge {category} />
												{#if index > 0}
													<Button
														intent="ghost"
														size="sm"
														format="icon"
														aria-label={m.gift_category_chip_promote_label(
															{
																category: label,
															},
														)}
														onclick={() => moveCategoryEarlier(index)}
														><ArrowLeftIcon /></Button
													>
												{/if}
												<Button
													intent="ghost"
													size="sm"
													format="icon"
													aria-label={m.gift_category_chip_remove_label({
														category: label,
													})}
													onclick={() => removeCategory(category.id)}
													><XIcon /></Button
												>
											</li>
										{/each}
									</ul>
									{#if selectedCategories.length > 1}
										<HelpText>{m.gift_categories_primary_help()}</HelpText>
									{/if}
									{#if isAtCategoryLimit}
										<HelpText
											>{m.gift_categories_limit_help({
												count: MAX_GIFT_CATEGORIES,
											})}</HelpText
										>
									{/if}
								{/if}
							{:else}
								<Select.Root type="single" disabled>
									<Select.Trigger class="w-full" disabled>
										{m.gift_category_none_enabled()}
									</Select.Trigger>
								</Select.Root>
								<HelpText>{m.gift_category_none_enabled_help()}</HelpText>
							{/if}
						</div>
					</div>

					{#if priorityLevels.length > 0}
						<div class={styles.formRowField()}>
							<div data-slot="gift-form-label-row" class={styles.formLabelRow()}>
								<Label>{m.gift_priority_label()}</Label>
							</div>
							<div class={styles.formControlStack()}>
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
													getPriorityDisplay(level.label)?.label() ??
													level.label}
												<Select.Item value={level.id} label={levelLabel}>
													{levelLabel}
												</Select.Item>
											{/each}
										</Select.Group>
									</Select.Content>
								</Select.Root>
							</div>
						</div>
					{/if}
				</div>

				<!-- Image (last field: source input only – the display-mode control and
			     the clickable target tiles live in the image column with the
			     preview they drive, #116 round 3) -->
				{#if demo}
					<p class="mt-3 text-sm text-muted-foreground">{m.demo_image_limits()}</p>
				{:else}
					<div class="mt-3 {styles.formField()}" data-testid="gift-image-source">
						<Label>
							{selectedImagePosition === null
								? m.gift_image_label()
								: m.gift_gallery_position({
										position: selectedImagePosition,
										count: gallery.images.length,
									})}
						</Label>
						<SegmentedToggle.Root
							bind:value={imageMode}
							disabled={mutationPending || isImageUploadPending}
							aria-label={m.gift_image_label()}
						>
							<SegmentedToggle.Item value="upload">
								<UploadIcon data-icon="inline-start" />
								{m.gift_image_upload_tab()}
							</SegmentedToggle.Item>
							<SegmentedToggle.Item value="url">
								<LinkIcon data-icon="inline-start" />
								{m.gift_image_url_tab()}
							</SegmentedToggle.Item>
						</SegmentedToggle.Root>
						{#if imageMode === 'url'}
							<Input
								bind:ref={imageUrlInput}
								bind:value={
									() => selectedImage?.imageUrl ?? '', handleImageUrlInput
								}
								placeholder="https://example.com/image.jpg"
								type="url"
							/>
						{:else}
							<!-- Remounts when the strip selects another image, so its preview and replace/remove act on it. -->
							{#key sourceFieldVersion}
								<ImageUpload
									bind:this={imageUploadRef}
									target="gift-image"
									disabled={mutationPending}
									size="small"
									initialPreviewUrl={previewSrc ?? undefined}
									onUpload={handleImageUpload}
									onPendingChange={handleImageUploadPendingChange}
									onError={handleImageUploadError}
									onRemove={handleImageRemove}
								/>
							{/key}
						{/if}
					</div>
				{/if}
			</fieldset>
		</div>
	</div>

	<!-- Left column: the display-mode control on top, then the WYSIWYG stage below
	     it for all three modes (issue #183: Fill/Fit now render through the same
	     bordered stage as Manual – a static, non-interactive preview – instead of
	     a plain unbounded ImageFrame, so switching to Manual is visually
	     seamless). The square live preview tile sits at the column's lower edge –
	     it doubles as the crop target switcher (round 3) – so it costs no form
	     space. -->
	<div
		class={cn(
			styles.imageColumn(),
			// Photo-workshop treatment (issue #189 REQ-6): the inset sticker panel below
			// supplies the framing, so the shared dashed column seam stays dropped in edit
			// mode (issue #156); the column is just the dotted mat the panel floats on.
			// `h-auto` + safe centering: the panel takes its intrinsic (photo-aspect,
			// capped) height and centers on the mat — replacing the old fixed
			// `h-[400px]` that clipped tall portraits (issue #189 REQ-5). A taller panel, e.g. a
			// two-row image strip, scrolls in the column instead of overlapping itself (#591).
			'flex h-auto flex-col justify-center-safe border-none border-b-0 p-3 sm:overflow-y-auto sm:border-r-0 sm:p-4',
		)}
		data-testid="gift-image-column"
	>
		{#if hasImage}
			<!-- Photo-workshop panel (issue #189 REQ-6): groups the mode pill + adaptive
			     stage + preview tiles as one designed sticker unit on the dotted mat. -->
			<div class={styles.modeSectionPanel()}>
				{#if selectedImage !== null && selectedImage.previewSrc !== null}
					<!-- Display-mode control (#116 round 3): lives with the preview it drives,
				     docked on the panel's top edge. `presentedEditorMode` (#183 EXTRA)
				     normalizes an untouched legacy `auto` row to the mode it actually
				     renders as, so the highlighted pill never contradicts the stage below. -->
					<div class="flex flex-none justify-center pb-2.5">
						<ToggleGroup.Root
							type="single"
							bind:value={selectedEditorMode}
							onValueChange={setEditorMode}
							aria-label={m.image_fit_label()}
							class="max-w-full flex-wrap justify-center rounded-full border-2 border-ink bg-card px-1.5 py-1 shadow-sticker"
						>
							<ToggleGroup.Item
								value={IMAGE_EDITOR_MODES.fill}
								class="rounded-full"
								disabled={mutationPending}
							>
								{m.image_fit_fill()}
							</ToggleGroup.Item>
							<ToggleGroup.Item
								value={IMAGE_EDITOR_MODES.fit}
								class="rounded-full"
								disabled={mutationPending}
							>
								{m.image_fit_fit()}
							</ToggleGroup.Item>
							<ToggleGroup.Item
								value={IMAGE_EDITOR_MODES.manual}
								class="rounded-full"
								disabled={mutationPending}
							>
								{m.image_fit_manual()}
							</ToggleGroup.Item>
						</ToggleGroup.Root>
					</div>
					<div class="flex flex-none justify-center pb-2.5">
						<ToggleGroup.Root
							type="single"
							bind:value={selectedBgColor}
							onValueChange={setBgColor}
							aria-label={m.image_background_label()}
							class="max-w-full flex-wrap justify-center rounded-full border-2 border-ink bg-card px-1.5 py-1 shadow-sticker"
						>
							<ToggleGroup.Item
								value="#ffffff"
								class="rounded-full"
								disabled={mutationPending}
							>
								{m.image_background_white()}
							</ToggleGroup.Item>
							<ToggleGroup.Item
								value="#000000"
								class="rounded-full"
								disabled={mutationPending}
							>
								{m.image_background_black()}
							</ToggleGroup.Item>
							<ToggleGroup.Item
								value="transparent"
								class="rounded-full"
								disabled={mutationPending}
							>
								{m.image_background_transparent()}
							</ToggleGroup.Item>
						</ToggleGroup.Root>
					</div>
					<!-- Fixed-window stage (#533): the window keeps the active target's
				     real size while the photo pans and zooms behind it. Fill/Fit show
				     their automatic framing; any edit promotes to Manual. Remounts per
				     selected image so the stage never carries one image's view to another. -->
					{#key selectedImage.id}
						<ImageCropStage
							src={selectedImage.previewSrc}
							alt={name || m.gift_image_preview()}
							targetAspect={GIFT_CROP_TARGET_SPECS[activeTarget].aspect}
							targetLabel={targetLabels[activeTarget]()}
							surfaceSize={activeSurfaceSize}
							framing={presentedEditorMode}
							fillColor={selectedImage.bgColor}
							tokenScope={IMAGE_TOKEN_SCOPES.wishlist}
							disabled={mutationPending}
							visibleWidthFraction={activeVisibleWidthFraction}
							stageClass="h-[min(340px,45dvh)] min-h-[220px]"
							bind:cropRect={selectedImage.targetRects[activeTarget]}
							onchange={(rect) => selectedImage.editCrop(activeTarget, rect)}
						>
							{#snippet heading()}
								<span class="flex flex-wrap items-center gap-2">
									<span data-testid="crop-stage-editing">
										{selectedImagePosition === null
											? m.image_crop_editing({
													target: targetLabels[activeTarget](),
												})
											: m.gift_image_crop_editing_gallery({
													target: targetLabels[activeTarget](),
													position: selectedImagePosition,
													count: gallery.images.length,
												})}
									</span>
									{#if !demo}
										<!-- Click-to-replace affordance (issue #131 REQ-1). -->
										<Button
											type="button"
											intent="ghost"
											size="sm"
											format="icon"
											onclick={openImageEditor}
											disabled={mutationPending}
											aria-label={m.gift_image_replace_cta()}
										>
											<PencilIcon data-icon="solo" />
										</Button>
									{/if}
								</span>
							{/snippet}
						</ImageCropStage>
					{/key}
				{:else}
					<p class={styles.imagePendingSource()} data-testid="gift-image-pending-source">
						<LinkIcon aria-hidden="true" />
						{m.gift_image_strip_pending_hint()}
					</p>
				{/if}
				<GiftImageStrip
					items={stripItems}
					selectedId={selectedImage?.id ?? null}
					disabled={mutationPending || isImageUploadPending}
					canAdd={!demo}
					onselect={selectGalleryImage}
					onremove={removeGalleryImage}
					onreorder={(orderedIds) => gallery.reorder(orderedIds)}
					onupload={handleStripUpload}
					onuploadpendingchange={handleStripUploadPendingChange}
					onaddurl={() => void addImageFromLink()}
				/>
				{#if selectedImage !== null && selectedImage.previewSrc !== null}
					<!-- The tiles are the crop-target switcher and the in-context check:
				     each renders what Save persists, with its framing status. -->
					<GiftImagePreviewSlots
						class="flex-none pt-2.5"
						src={selectedImage.previewSrc}
						alt={name || m.gift_image_preview()}
						imageMeta={selectedImage.imageMeta}
						{activeTarget}
						statusLabels={selectedImage.targetStatusLabels}
						onTileSelect={handleTileSelect}
						onFollowSquare={isCropMode && selectedImage.ownTargets.has('thumb')
							? followSquareCrop
							: undefined}
						disabled={mutationPending}
					/>
				{/if}
			</div>
		{:else}
			<!-- Empty state (issue #131 REQ-2): the whole column is an explicit
			     clickable upload placeholder, restyled as a sticker panel (issue #189
			     REQ-6) so the empty column reads as intentional as the filled one. -->
			<button
				type="button"
				class={styles.imagePlaceholder()}
				disabled={mutationPending || demo}
				onclick={openImageEditor}
				aria-label={demo ? m.demo_image_limits() : m.gift_image_upload_cta()}
			>
				<UploadIcon class="size-16 text-ink-faint" />
				<span class="text-sm font-semibold text-muted-foreground">
					{demo ? m.demo_image_limits() : m.gift_image_upload_cta()}
				</span>
				{#if !demo}<span class="text-xs text-muted-foreground"
						>{m.gift_image_upload_hint()}</span
					>{/if}
			</button>
		{/if}
	</div>

	<!-- Manager actions scroll with the form on mobile. Save/Cancel are hidden here on mobile
	     and rendered by `mobileSubmitFooter` below; desktop keeps them in this block. -->
	<div class={styles.formActions()}>
		{#if isEdit && gift !== null}
			{#if releaseGift !== null}
				<ReleaseReservationButton
					gift={releaseGift}
					size="md"
					disabled={mutationPending}
					class={styles.releaseButton()}
				/>
			{/if}

			{#if canDelete}
				<Button
					intent="danger"
					class={styles.deleteButton()}
					disabled={mutationPending || isImageUploadPending}
					onclick={() => void handleDelete()}
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

		<div class={styles.submitWrapper()}>
			{@render submitActions()}
		</div>
	</div>
</div>

<!-- Mobile-only pinned Save/Cancel footer (see `submitWrapper` in
     gift_detail_modal_variants.ts for why this is a separate element from the
     desktop one above): a true DOM sibling OUTSIDE `body`'s scroll, so it
     stays visible regardless of scroll position – unlike a `position: sticky`
     copy nested inside the scroll, which only re-enters view once scrolled
     down to it (mobile edit modal scroll fix, follow-up). Hidden on desktop,
     where `submitWrapper` above already renders Save inline with the manager
     actions. -->
<div class={styles.mobileSubmitFooter()} data-testid="gift-mobile-submit-footer">
	{@render submitActions()}
</div>

{#if canCreateCategory}
	<GiftCategoryQuickAddDialog
		bind:open={categoryQuickAddOpen}
		{wishlistId}
		target={{ kind: 'editor' }}
		categories={categorySelectOptions}
		oncreated={selectCreatedCategory}
	/>
{/if}
