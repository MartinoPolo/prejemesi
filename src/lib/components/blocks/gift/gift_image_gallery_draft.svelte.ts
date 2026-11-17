import { IMAGE_FIT_MODES, normalizeFrameFill } from '$lib/components/derived/image-frame/index.js';
import {
	centeredCropRect,
	classifyGiftFraming,
	cropRectToFocalZoom,
	giftFramingPresetRect,
	giftTargetFrameProps,
	mergeGiftTargetCrops,
	normalizedCropAspect,
	renderedGiftTargetRect,
	sameCropRect,
	CENTERED_FOCAL,
	transferGiftFramingRect,
	FULL_CROP_RECT,
	GIFT_CROP_TARGET_SPECS,
	GIFT_EDITOR_CROP_TARGET_VALUES,
	GIFT_FRAMINGS,
	IMAGE_ZOOM_BASE,
	type GiftEditorCropTarget,
	type GiftFraming,
	type GiftFramingPreset,
	type ImageCropRect,
	type ImageMetadata,
	type ImageTargetCrop,
} from '$lib/modules/images/index.js';
import { resolveGiftImageUrl } from '$lib/modules/images/public_url.js';
import { MAX_GIFT_IMAGES, hasImageSource, type GiftImage } from '$lib/modules/gifts/gift_images.js';
import type { UploadResult } from '$lib/modules/uploads/types.js';

type ExplicitImageBackground = '#ffffff' | '#000000';

type TargetRects = Record<GiftEditorCropTarget, ImageCropRect>;

function giftTargetAspect(target: GiftEditorCropTarget, imageRatio: number): number {
	return normalizedCropAspect(GIFT_CROP_TARGET_SPECS[target].aspect, imageRatio);
}

function mapGiftTargets<Value>(
	valueFor: (target: GiftEditorCropTarget) => Value,
): Record<GiftEditorCropTarget, Value> {
	return { square: valueFor('square'), thumb: valueFor('thumb') };
}

/** A stored framing's status before the photo is measured, from its focal point and zoom. */
function unmeasuredFraming(meta: ImageMetadata | null, target: GiftEditorCropTarget): GiftFraming {
	const { fitMode, focal, zoom } = giftTargetFrameProps(meta, target);
	if (fitMode === IMAGE_FIT_MODES.containPadded) {
		return GIFT_FRAMINGS.whole;
	}
	const centered =
		focal.x === CENTERED_FOCAL.x && focal.y === CENTERED_FOCAL.y && zoom === IMAGE_ZOOM_BASE;
	return centered ? GIFT_FRAMINGS.fill : GIFT_FRAMINGS.custom;
}

function pinnedTargetCrop(rect: ImageCropRect): ImageTargetCrop {
	return { cropRect: { ...rect }, ...cropRectToFocalZoom(rect) };
}

/**
 * Untouched views keep the stored metadata verbatim. Only a stored fill already in canonical form
 * stays as is; legacy `transparent` saves as the canonical `null`.
 */
function untouchedImageMeta(stored: ImageMetadata | null, bgColor: string | null): ImageMetadata {
	const meta = stored ?? {
		fitMode: IMAGE_FIT_MODES.auto,
		cropRect: null,
		focal: { ...CENTERED_FOCAL },
		zoom: IMAGE_ZOOM_BASE,
	};
	return (meta.bgColor ?? null) === bgColor ? { ...meta } : { ...meta, bgColor };
}

/** Both views on the same preset persist as its plain fit mode. */
function presetImageMeta(preset: GiftFramingPreset, bgColor: string | null): ImageMetadata {
	return {
		fitMode:
			preset === GIFT_FRAMINGS.fill
				? IMAGE_FIT_MODES.coverCrop
				: IMAGE_FIT_MODES.containPadded,
		cropRect: null,
		focal: { ...CENTERED_FOCAL },
		zoom: IMAGE_ZOOM_BASE,
		bgColor,
	};
}

/** Pins both views on a cover-crop that keeps the base and any target the editor does not offer. */
function pinnedImageMeta(
	base: ImageMetadata | null,
	targetRects: TargetRects,
	bgColor: string | null,
): ImageMetadata {
	const retiredTargets = { ...base?.targets };
	for (const target of GIFT_EDITOR_CROP_TARGET_VALUES) {
		delete retiredTargets[target];
	}
	return {
		fitMode: IMAGE_FIT_MODES.coverCrop,
		cropRect: base?.cropRect ?? null,
		focal: base?.focal ?? { ...CENTERED_FOCAL },
		zoom: base?.zoom ?? IMAGE_ZOOM_BASE,
		bgColor,
		targets: mergeGiftTargetCrops(
			retiredTargets,
			mapGiftTargets((target) => pinnedTargetCrop(targetRects[target])),
		),
	};
}

let createdDraftCount = 0;

/**
 * One gallery image in the gift editor: its source and its own presentation. Karta (`square`)
 * and Seznam (`thumb`) are independent views, each a concrete window on the photo: it opens on
 * what that surface renders today, then changes only through its own pan/zoom, its Vyplnit or
 * Celý preset, or a one-shot copy from the other view. The status of a view is derived from its
 * window. An image whose views are untouched passes its persisted metadata through (legacy
 * `auto`, base focal/zoom and retired targets included), so opening and saving never rewrites
 * old framing.
 */
export class GiftImageDraft {
	/** Stable identity across reorders, for keyed rendering and selection. */
	readonly id = `gift-image-${String(++createdDraftCount)}`;
	// The persisted baseline. Field defaults only satisfy TypeScript's initialization order for the
	// lazily evaluated deriveds below; the constructor sets the real values.
	readonly #initialImageUrl: string = '';
	readonly #initialImageKey: string = '';
	readonly #initialMeta: ImageMetadata | null = null;
	readonly #initialBgColor: string | null = null;

	imageUrl = $state('');
	imageKey = $state('');
	/** `null` is the canonical dotted default; legacy `transparent` normalizes to it on save. */
	bgColor = $state<string | null>(null);
	/** Natural width ÷ height of the source it was measured for. */
	#measurement = $state.raw<{ sourceKey: string; ratio: number } | null>(null);
	/** Windows the user set in this session, for the source they were set on. */
	#edits = $state.raw<{ sourceKey: string; rects: Partial<TargetRects> }>({
		sourceKey: '',
		rects: {},
	});

	constructor(initial: GiftImage | null = null) {
		const meta = initial?.imageMeta ?? null;
		this.#initialImageUrl = initial?.imageUrl ?? '';
		this.#initialImageKey = initial?.imageKey ?? '';
		this.#initialMeta = meta;
		this.#initialBgColor = normalizeFrameFill(meta?.bgColor);
		this.imageUrl = this.#initialImageUrl;
		this.imageKey = this.#initialImageKey;
		this.bgColor = this.#initialBgColor;
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

	readonly #sourceKey = $derived(`${this.imageUrl.trim()}\n${this.imageKey}`);

	readonly previewSrc = $derived(
		resolveGiftImageUrl(
			this.imageUrl.trim() === '' ? null : this.imageUrl.trim(),
			this.imageKey,
		),
	);

	/** The current source's natural width ÷ height; framing edits wait for it. */
	readonly naturalRatio = $derived(
		this.#measurement?.sourceKey === this.#sourceKey ? this.#measurement.ratio : null,
	);

	readonly #editedRects = $derived(
		this.#edits.sourceKey === this.#sourceKey ? this.#edits.rects : {},
	);

	/**
	 * The windows each view opens on once measured: what the surface renders for the persisted
	 * metadata, or the centered cover for a new source. Also the baseline that tells edits apart.
	 */
	readonly #openingRects = $derived.by((): TargetRects | null => {
		const ratio = this.naturalRatio;
		if (ratio === null) {
			return null;
		}
		return mapGiftTargets((target) =>
			this.imageReplaced
				? centeredCropRect(giftTargetAspect(target, ratio))
				: renderedGiftTargetRect(this.#initialMeta, target, ratio),
		);
	});

	/** Each view's window; the identity rect stands in until the photo is measured. */
	readonly targetRects = $derived(
		mapGiftTargets(
			(target) =>
				this.#editedRects[target] ?? this.#openingRects?.[target] ?? { ...FULL_CROP_RECT },
		),
	);

	/** Each view's status: Vyplnit, Celý or Vlastní. */
	readonly framings = $derived(
		mapGiftTargets((target): GiftFraming => {
			const ratio = this.naturalRatio;
			if (ratio !== null) {
				return classifyGiftFraming(
					this.targetRects[target],
					giftTargetAspect(target, ratio),
				);
			}
			return this.imageReplaced
				? GIFT_FRAMINGS.fill
				: unmeasuredFraming(this.#initialMeta, target);
		}),
	);

	readonly #framingChanged = $derived(
		GIFT_EDITOR_CROP_TARGET_VALUES.some((target) => {
			const edited = this.#editedRects[target];
			const opening = this.#openingRects?.[target];
			return edited !== undefined && opening !== undefined && !sameCropRect(edited, opening);
		}),
	);

	/** Whether saving would persist anything different for this image. */
	readonly changed = $derived(
		this.imageReplaced ||
			(this.hasImage && (this.bgColor !== this.#initialBgColor || this.#framingChanged)),
	);

	/** The metadata a save persists: stored as is, a shared preset, or both views pinned. */
	readonly imageMeta = $derived.by((): ImageMetadata => {
		if (!this.imageReplaced && !this.#framingChanged) {
			return untouchedImageMeta(this.#initialMeta, this.bgColor);
		}
		const { square, thumb } = this.framings;
		if (square === thumb && square !== GIFT_FRAMINGS.custom) {
			return presetImageMeta(square, this.bgColor);
		}
		return pinnedImageMeta(
			this.imageReplaced ? null : this.#initialMeta,
			this.targetRects,
			this.bgColor,
		);
	});

	/**
	 * Records the current source's natural width ÷ height, which opens both views. A late load
	 * of a source replaced since (`measuredSrc` differs from the preview) is ignored.
	 */
	measure(ratio: number, measuredSrc: string | null = this.previewSrc): void {
		if (measuredSrc === this.previewSrc && Number.isFinite(ratio) && ratio > 0) {
			this.#measurement = { sourceKey: this.#sourceKey, ratio };
		}
	}

	#setTargetRect(target: GiftEditorCropTarget, rect: ImageCropRect): void {
		this.#edits = {
			sourceKey: this.#sourceKey,
			rects: { ...this.#editedRects, [target]: { ...rect } },
		};
	}

	/** A pan or zoom of one view; the other view never moves. */
	editCrop(target: GiftEditorCropTarget, rect: ImageCropRect): void {
		if (this.naturalRatio !== null) {
			this.#setTargetRect(target, rect);
		}
	}

	applyPreset(target: GiftEditorCropTarget, preset: GiftFramingPreset): void {
		const ratio = this.naturalRatio;
		if (ratio !== null) {
			this.#setTargetRect(
				target,
				giftFramingPresetRect(preset, giftTargetAspect(target, ratio)),
			);
		}
	}

	/** Copies one view's framing to the other once; later edits of either stay independent. */
	copyFraming(fromTarget: GiftEditorCropTarget, toTarget: GiftEditorCropTarget): void {
		const ratio = this.naturalRatio;
		if (ratio !== null) {
			this.#setTargetRect(
				toTarget,
				transferGiftFramingRect(this.targetRects[fromTarget], fromTarget, toTarget, ratio),
			);
		}
	}

	chooseBackground(value: ExplicitImageBackground | 'transparent'): void {
		this.bgColor = value === 'transparent' ? null : value;
	}

	/** A new source starts from the automatic centered framing on both views. */
	useUpload(result: UploadResult): void {
		this.imageKey = result.objectKey;
		this.imageUrl = result.publicUrl;
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
 * selected and drives the crop stage, framing controls and previews. An image without a source
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
