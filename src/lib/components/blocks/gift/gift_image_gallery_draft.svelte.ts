import { SvelteSet } from 'svelte/reactivity';
import * as m from '$lib/paraglide/messages.js';
import {
	IMAGE_FIT_MODES,
	normalizeFrameFill,
	resolveAutoFit,
} from '$lib/components/derived/image-frame/index.js';
import { editorModeStatusLabel } from '$lib/components/derived/image-crop/editor_mode_status_label.js';
import {
	buildManualGiftTargets,
	fitModeForEditorMode,
	giftEditorModeFromMeta,
	imageMetaToFrameProps,
	normalizedCropAspect,
	ownGiftTargets,
	reprojectCropRect,
	resolveGiftTargetCrop,
	seedCropRectFromLegacyMeta,
	FULL_CROP_RECT,
	GIFT_CROP_TARGET_SPECS,
	GIFT_EDITOR_CROP_TARGET_VALUES,
	IMAGE_EDITOR_MODES,
	type GiftEditorCropTarget,
	type ImageCropRect,
	type ImageEditorMode,
	type ImageMetadata,
} from '$lib/modules/images/index.js';
import { resolveGiftImageUrl } from '$lib/modules/images/public_url.js';
import { MAX_GIFT_IMAGES, hasImageSource, type GiftImage } from '$lib/modules/gifts/gift_images.js';
import type { UploadResult } from '$lib/modules/uploads/types.js';

const CROP_RECT_EQUALITY_EPSILON = 1e-9;

type ExplicitImageBackground = '#ffffff' | '#000000';

function cropRectsEqual(left: ImageCropRect, right: ImageCropRect): boolean {
	return (
		Math.abs(left.x - right.x) < CROP_RECT_EQUALITY_EPSILON &&
		Math.abs(left.y - right.y) < CROP_RECT_EQUALITY_EPSILON &&
		Math.abs(left.w - right.w) < CROP_RECT_EQUALITY_EPSILON &&
		Math.abs(left.h - right.h) < CROP_RECT_EQUALITY_EPSILON
	);
}

function initTargetRects(meta: ImageMetadata | null | undefined) {
	const rects = {} as Record<GiftEditorCropTarget, ImageCropRect>;
	for (const target of GIFT_EDITOR_CROP_TARGET_VALUES) {
		// A persisted per-target rect restores exactly; the shared carry-over chain
		// (`resolveGiftTargetCrop`) keeps this editor seed in lockstep with the renderer's
		// fallback. Otherwise seed from the base-level metadata (issue #123: a legacy row with
		// focal/zoom but no cropRect must reconstruct its real framing, not fall back to the
		// always-centered FULL_CROP_RECT – the stage snaps this seed to the target's real aspect
		// once the image is measured).
		const targetCrop = resolveGiftTargetCrop(meta?.targets, target);
		rects[target] =
			targetCrop !== undefined
				? { ...targetCrop.cropRect }
				: seedCropRectFromLegacyMeta(meta ?? {});
	}
	return rects;
}

let createdDraftCount = 0;

/**
 * One gallery image in the gift editor: its source and its own presentation (#116, #533).
 * The editor offers Fill / Fit / Manual, mapped onto the persisted fitMode. Manual crops are
 * edited per target, and a target without its own crop inherits (`thumb` follows `square`).
 * An untouched image passes its persisted metadata through (legacy `auto` and base focal/zoom
 * rows included), so opening and saving never silently rewrites old framing.
 */
export class GiftImageDraft {
	/** Stable identity across reorders, for keyed rendering and selection. */
	readonly id = `gift-image-${String(++createdDraftCount)}`;
	// The persisted baseline. Field defaults only satisfy TypeScript's initialization order for the
	// lazily evaluated deriveds below; the constructor sets the real values.
	readonly #initialImageUrl: string = '';
	readonly #initialImageKey: string = '';
	readonly #initialMeta: ImageMetadata | null = null;
	readonly #initialTargetRects: Record<GiftEditorCropTarget, ImageCropRect> =
		initTargetRects(null);
	readonly #initialOwnTargets: ReadonlySet<GiftEditorCropTarget> = ownGiftTargets(undefined);
	readonly #initialEditorMode: ImageEditorMode = IMAGE_EDITOR_MODES.fill;
	readonly #initialBgColor: string | null = null;
	/** The persisted Fit margin; zero when the image is not saved as Fit. */
	readonly #initialMargin: number = 0;
	/** The persisted fitMode an untouched save keeps (legacy `auto` included); null for a new image. */
	readonly #legacyFitMode: ImageMetadata['fitMode'] | null = null;

	imageUrl = $state('');
	imageKey = $state('');
	editorMode = $state<ImageEditorMode>(IMAGE_EDITOR_MODES.fill);
	/** Whether the user touched the display mode; an untouched image keeps its persisted fitMode. */
	modeDirty = $state(false);
	/** `null` is the canonical dotted default; legacy `transparent` normalizes to it on save. */
	bgColor = $state<string | null>(null);
	/** Fit margin kept for this session; a save persists it only while the image is Fit. */
	margin = $state(0);
	targetRects = $state({} as Record<GiftEditorCropTarget, ImageCropRect>);
	/** Natural width ÷ height once the preview has loaded. */
	measuredNaturalRatio = $state<number | null>(null);
	/** Targets whose rect differs from the persisted one in this session. */
	readonly dirtyTargets = new SvelteSet<GiftEditorCropTarget>();
	/** Targets with their own crop (persisted or drawn this session); the rest inherit. */
	readonly ownTargets = new SvelteSet<GiftEditorCropTarget>();

	constructor(initial: GiftImage | null = null) {
		const meta = initial?.imageMeta ?? null;
		this.#initialImageUrl = initial?.imageUrl ?? '';
		this.#initialImageKey = initial?.imageKey ?? '';
		this.#initialMeta = meta;
		this.#initialTargetRects = initTargetRects(meta);
		this.#initialOwnTargets = ownGiftTargets(meta?.targets);
		this.#initialEditorMode = giftEditorModeFromMeta(meta);
		this.#initialBgColor = normalizeFrameFill(meta?.bgColor);
		this.#initialMargin = imageMetaToFrameProps(meta).margin;
		this.#legacyFitMode =
			this.#initialImageUrl !== '' || this.#initialImageKey !== ''
				? (meta?.fitMode ?? IMAGE_FIT_MODES.auto)
				: null;
		this.imageUrl = this.#initialImageUrl;
		this.imageKey = this.#initialImageKey;
		this.editorMode = this.#initialEditorMode;
		this.bgColor = this.#initialBgColor;
		this.margin = this.#initialMargin;
		this.targetRects = initTargetRects(meta);
		for (const target of this.#initialOwnTargets) {
			this.ownTargets.add(target);
		}
	}

	/** A new image uploaded in this session, starting from the automatic centered framing. */
	static fromUpload(result: UploadResult): GiftImageDraft {
		const draft = new GiftImageDraft();
		draft.useUpload(result);
		return draft;
	}

	readonly hasImage = $derived(this.imageUrl !== '' || this.imageKey !== '');

	/** A different source invalidates the persisted geometry, which targets the old pixels. */
	readonly imageReplaced = $derived(
		this.imageUrl.trim() !== this.#initialImageUrl || this.imageKey !== this.#initialImageKey,
	);

	readonly #ownershipChanged = $derived(
		this.ownTargets.size !== this.#initialOwnTargets.size ||
			[...this.ownTargets].some((target) => !this.#initialOwnTargets.has(target)),
	);

	readonly #hasCropSessionEdits = $derived(this.dirtyTargets.size > 0 || this.#ownershipChanged);

	readonly #initialFillWasCentered = $derived(
		(this.#initialMeta?.cropRect ?? null) === null &&
			(this.#initialMeta?.focal?.x ?? 50) === 50 &&
			(this.#initialMeta?.focal?.y ?? 50) === 50 &&
			(this.#initialMeta?.zoom ?? 1) === 1,
	);

	readonly #imageModeChanged = $derived(
		this.#legacyFitMode === IMAGE_FIT_MODES.auto
			? this.modeDirty
			: this.editorMode !== this.#initialEditorMode ||
					(this.modeDirty &&
						this.editorMode === IMAGE_EDITOR_MODES.fill &&
						!this.#initialFillWasCentered),
	);

	/** Legacy rows keep their stored fitMode (incl. `auto`) until the mode or image changes. */
	readonly #savedFitMode = $derived(
		this.modeDirty || this.imageReplaced || this.#legacyFitMode === null
			? fitModeForEditorMode(this.editorMode)
			: this.#legacyFitMode,
	);

	/** Like manual crops outside Manual, a margin outside Fit is dropped on save. */
	readonly #savedMargin = $derived(
		this.#savedFitMode === IMAGE_FIT_MODES.containPadded ? this.margin : 0,
	);

	readonly #presentationChanged = $derived(
		this.hasImage &&
			(this.#imageModeChanged ||
				this.bgColor !== this.#initialBgColor ||
				this.#savedMargin !== this.#initialMargin ||
				(this.editorMode === IMAGE_EDITOR_MODES.manual && this.#hasCropSessionEdits)),
	);

	/** Whether saving would persist anything different for this image. */
	readonly changed = $derived(this.imageReplaced || this.#presentationChanged);

	// fallow-ignore-next-line unused-class-member
	readonly previewSrc = $derived(
		resolveGiftImageUrl(
			this.imageUrl.trim() === '' ? null : this.imageUrl.trim(),
			this.imageKey,
		),
	);

	/**
	 * Outside Manual there are no manual crops: leaving Manual drops them on save, and a replaced
	 * image never inherits crops drawn for the old pixels. Inside Manual, the targets that own a
	 * crop are pinned and the rest inherit.
	 */
	#buildTargets(): ImageMetadata['targets'] {
		if (this.editorMode !== IMAGE_EDITOR_MODES.manual) {
			return undefined;
		}
		return buildManualGiftTargets(
			this.targetRects,
			this.ownTargets,
			this.#hasCropSessionEdits,
			this.imageReplaced ? undefined : this.#initialMeta?.targets,
		);
	}

	/**
	 * The metadata a save persists. Base focal/zoom/cropRect stay as persisted for an unreplaced
	 * image so legacy rows render unchanged (#116 REQ-8); explicitly choosing Fill re-centers, and
	 * a replaced image starts from the automatic centered default.
	 */
	readonly imageMeta = $derived.by((): ImageMetadata => {
		const base = this.imageReplaced ? null : this.#initialMeta;
		const recentered =
			base === null || (this.modeDirty && this.editorMode === IMAGE_EDITOR_MODES.fill);
		return {
			fitMode: this.#savedFitMode,
			cropRect: recentered ? null : (base?.cropRect ?? null),
			focal: recentered ? { x: 50, y: 50 } : (base?.focal ?? { x: 50, y: 50 }),
			zoom: recentered ? 1 : (base?.zoom ?? 1),
			bgColor: this.bgColor,
			...(this.#savedMargin > 0 ? { margin: this.#savedMargin } : {}),
			targets: this.#buildTargets(),
		};
	});

	/**
	 * Legacy `auto` honesty (#183): a persisted `auto` resolves to cover or contain per image at
	 * render time, while the editor reads it as Fill. Once measured, the presented mode matches the
	 * real render without dirtying the image or rewriting the persisted `auto`.
	 */
	readonly #legacyAutoRendersAsFit = $derived(
		this.#legacyFitMode === IMAGE_FIT_MODES.auto &&
			!this.modeDirty &&
			!this.imageReplaced &&
			this.measuredNaturalRatio !== null &&
			resolveAutoFit(this.measuredNaturalRatio, GIFT_CROP_TARGET_SPECS.square.aspect) ===
				IMAGE_FIT_MODES.containPadded,
	);

	/** The mode the toggle and preview show; persisted data stays untouched. */
	readonly presentedEditorMode = $derived(
		this.#legacyAutoRendersAsFit ? IMAGE_EDITOR_MODES.fit : this.editorMode,
	);

	// fallow-ignore-next-line unused-class-member
	readonly targetStatusLabels = $derived.by((): Record<GiftEditorCropTarget, string> => {
		if (this.presentedEditorMode !== IMAGE_EDITOR_MODES.manual) {
			const modeLabel = editorModeStatusLabel(this.presentedEditorMode);
			return { square: modeLabel, thumb: modeLabel };
		}
		return {
			square: this.ownTargets.has('square')
				? m.image_crop_status_manual()
				: m.image_crop_status_automatic(),
			thumb: this.ownTargets.has('thumb')
				? m.image_crop_status_manual()
				: m.image_crop_status_follows_card(),
		};
	});

	/**
	 * A pan or zoom on the stage is a manual-crop intent (#533): in Fill/Fit it promotes the
	 * image to Manual with only the edited target owning a crop, so the other keeps inheriting.
	 */
	editCrop(target: GiftEditorCropTarget, rect: ImageCropRect): void {
		if (this.editorMode !== IMAGE_EDITOR_MODES.manual) {
			this.editorMode = IMAGE_EDITOR_MODES.manual;
			this.modeDirty = true;
			this.ownTargets.clear();
		}
		this.ownTargets.add(target);
		if (cropRectsEqual(rect, this.#initialTargetRects[target])) {
			this.dirtyTargets.delete(target);
		} else {
			this.dirtyTargets.add(target);
		}
	}

	/** Drops the thumbnail's own crop so it follows the card crop again. */
	// fallow-ignore-next-line unused-class-member
	followSquareCrop(): void {
		this.ownTargets.delete('thumb');
		this.dirtyTargets.delete('thumb');
	}

	/** A thumbnail without its own crop mirrors the card's focal point and zoom at its aspect. */
	// fallow-ignore-next-line unused-class-member
	syncFollowedThumbnail(): void {
		if (this.ownTargets.has('thumb') || this.measuredNaturalRatio === null) {
			return;
		}
		const followed = reprojectCropRect(
			this.targetRects.square,
			normalizedCropAspect(GIFT_CROP_TARGET_SPECS.thumb.aspect, this.measuredNaturalRatio),
		);
		if (!cropRectsEqual(followed, this.targetRects.thumb)) {
			this.targetRects.thumb = followed;
		}
	}

	chooseEditorMode(mode: ImageEditorMode, activeTarget: GiftEditorCropTarget): void {
		if (mode === IMAGE_EDITOR_MODES.fill) {
			// Explicit Fill re-centers the framing, so a later switch back to Manual starts from
			// that centered cover-crop.
			this.targetRects[activeTarget] = { ...FULL_CROP_RECT };
		}
		this.editorMode = mode;
		this.modeDirty = true;
	}

	chooseBackground(value: ExplicitImageBackground | 'transparent'): void {
		this.bgColor = value === 'transparent' ? null : value;
	}

	/**
	 * Picking a margin is a Fit choice, so any other editor mode becomes Fit: Fill (including
	 * legacy `auto`, which a measured image may present as Fit) or Manual.
	 */
	chooseMargin(margin: number): void {
		if (this.editorMode !== IMAGE_EDITOR_MODES.fit) {
			this.editorMode = IMAGE_EDITOR_MODES.fit;
			this.modeDirty = true;
		}
		this.margin = margin;
	}

	/** A new source starts from the automatic centered Fill framing. */
	useUpload(result: UploadResult): void {
		this.imageKey = result.objectKey;
		this.imageUrl = result.publicUrl;
		this.editorMode = IMAGE_EDITOR_MODES.fill;
		this.margin = 0;
		this.targetRects = initTargetRects(null);
		this.dirtyTargets.clear();
	}

	/** The image as the gift save persists it; only meaningful while `hasImage`. */
	toGiftImage(): GiftImage {
		return {
			imageUrl: this.imageUrl.trim() || null,
			imageKey: this.imageKey || null,
			imageMeta: $state.snapshot(this.imageMeta) as ImageMetadata,
		};
	}
}

/**
 * The images a gift opens with in the editor. A gift row always mirrors its cover, so a gift
 * whose gallery was not loaded still edits its cover.
 */
function editableGiftImages(gift: GiftImageSource | null): readonly GiftImage[] {
	if (gift === null) {
		return [];
	}
	if (gift.images.length > 0) {
		return gift.images;
	}
	const cover: GiftImage = {
		imageUrl: gift.imageUrl === '' ? null : gift.imageUrl,
		imageKey: gift.imageKey === '' ? null : gift.imageKey,
		imageMeta: gift.imageMeta,
	};
	return hasImageSource(cover) ? [cover] : [];
}

interface GiftImageSource {
	imageUrl: string | null;
	imageKey: string | null;
	imageMeta: ImageMetadata | null;
	images: readonly GiftImage[];
}

/**
 * The editor's ordered gallery (#591): up to eight images, the first is the cover. One image is
 * selected and drives the crop stage, mode selector and previews. An image without a source
 * (a link being typed, or a cleared one) is a draft slot: it is neither saved nor counted as a
 * change, and selecting another image drops it.
 */
export class GiftImageGalleryDraft {
	images = $state.raw<GiftImageDraft[]>([]);
	#selectedId = $state<string | null>(null);
	readonly #initialIds: readonly string[] = [];

	constructor(gift: GiftImageSource | null) {
		this.images = editableGiftImages(gift).map((image) => new GiftImageDraft(image));
		this.#initialIds = this.images.map((image) => image.id);
		this.#selectedId = this.images[0]?.id ?? null;
	}

	readonly selected = $derived(
		this.images.find((image) => image.id === this.#selectedId) ?? this.images[0] ?? null,
	);

	/** Images a save persists, in order. */
	readonly sourcedImages = $derived(this.images.filter((image) => image.hasImage));

	readonly atLimit = $derived(this.images.length >= MAX_GIFT_IMAGES);

	/** Whether saving would change the gallery: an image added, removed, reordered or edited. */
	readonly changed = $derived(
		this.sourcedImages.length !== this.#initialIds.length ||
			this.sourcedImages.some(
				(image, index) => image.id !== this.#initialIds[index] || image.changed,
			),
	);

	select(id: string): void {
		this.images = this.images.filter((image) => image.hasImage || image.id === id);
		this.#selectedId = id;
	}

	/** Appends and selects an image; false at the limit. */
	add(image: GiftImageDraft): boolean {
		const withoutDraftSlots = this.images.filter((candidate) => candidate.hasImage);
		if (withoutDraftSlots.length >= MAX_GIFT_IMAGES) {
			return false;
		}
		this.images = [...withoutDraftSlots, image];
		this.#selectedId = image.id;
		return true;
	}

	/** Removes an image; the selection moves to the image that took its place, else the previous. */
	remove(id: string): void {
		const index = this.images.findIndex((image) => image.id === id);
		if (index === -1) {
			return;
		}
		const remaining = this.images.filter((image) => image.id !== id);
		if (this.selected?.id === id) {
			this.#selectedId = (remaining[index] ?? remaining[index - 1])?.id ?? null;
		}
		this.images = remaining;
	}

	/** Applies an order of the current image ids; unknown or missing ids leave the order alone. */
	reorder(orderedIds: readonly string[]): void {
		const reordered = orderedIds.flatMap(
			(id) => this.images.find((image) => image.id === id) ?? [],
		);
		if (reordered.length === this.images.length) {
			this.images = reordered;
		}
	}

	/** Sets the selected image's link, or starts the first image when the gift has none. */
	setSelectedImageUrl(imageUrl: string): void {
		if (this.selected !== null) {
			this.selected.imageUrl = imageUrl;
			return;
		}
		if (imageUrl === '') {
			return;
		}
		const image = new GiftImageDraft();
		image.imageUrl = imageUrl;
		this.add(image);
	}

	/** Uses an upload for the selected image, or as the first image when the gift has none. */
	useUploadForSelected(result: UploadResult): void {
		if (this.selected === null) {
			this.add(GiftImageDraft.fromUpload(result));
			return;
		}
		this.selected.useUpload(result);
	}

	/** The complete ordered gallery a save sends. */
	toGiftImages(): GiftImage[] {
		return this.sourcedImages.map((image) => image.toGiftImage());
	}
}
