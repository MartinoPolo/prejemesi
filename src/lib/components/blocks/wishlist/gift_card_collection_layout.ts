import { observeDepthChange } from '$lib/theme/depth_change.js';
import { mutationsMayChangeCardLayout } from '../gift/gift_card_layout_inert.js';
import { GIFT_MOTION_DRAGGING_ATTRIBUTE } from './gift_pointer_reorder.svelte.js';

const GIFT_CARD_TRACKS = ['title', 'description', 'links', 'price', 'actions'] as const;

type GiftCardTrack = (typeof GIFT_CARD_TRACKS)[number];

const trackProperty = (track: GiftCardTrack) => `--gift-card-${track}-track-height`;

/** Two columns give each card at most half the grid; one column gives it all of it. */
const SINGLE_COLUMN_MINIMUM_WIDTH_SHARE = 0.75;

/**
 * A single-column card spans the grid while side-by-side cards share it, so a rendered card's
 * layout width tells the cases apart without reading the grid template, which would restyle the
 * whole collection. Layout widths also ignore the transforms motion animates.
 */
function gridHasMultipleColumns(collection: HTMLElement, cards: readonly HTMLElement[]): boolean {
	const grid = collection.querySelector<HTMLElement>('[data-testid="wishlist-gift-card-grid"]');
	const cardWidth = cards.find((card) => card.offsetWidth > 0)?.offsetWidth;
	if (grid === null || cardWidth === undefined) {
		return false;
	}

	return cardWidth < grid.clientWidth * SINGLE_COLUMN_MINIMUM_WIDTH_SHARE;
}

function cardElements(collection: HTMLElement): HTMLElement[] {
	return Array.from(
		collection.querySelectorAll<HTMLElement>('[data-testid="gift-card-surface"]'),
	);
}

function trackElements(collection: HTMLElement, track: GiftCardTrack): HTMLElement[] {
	return Array.from(
		collection.querySelectorAll<HTMLElement>(`[data-gift-card-track="${track}"]`),
	);
}

const IMAGE_TRACK_PROPERTY = '--gift-card-image-track-height';
const IMAGE_TRACK_SELECTOR = '[data-gift-card-image-track]';

/**
 * Each track height is a non-inheriting property on the element that consumes it (`app.css`). A
 * measurement suspends them through this attribute, whose rules only restyle the track elements,
 * and rewrites a property only when its value changes.
 */
const MEASURING_ATTRIBUTE = 'data-gift-card-measuring';

function setPropertyIfChanged(element: HTMLElement, property: string, value: string | null): void {
	if (element.style.getPropertyValue(property) === (value ?? '')) {
		return;
	}
	if (value === null) {
		element.style.removeProperty(property);
	} else {
		element.style.setProperty(property, value);
	}
}

function removeTrackHeights(collection: HTMLElement, cards: readonly HTMLElement[]): void {
	for (const track of GIFT_CARD_TRACKS) {
		for (const element of trackElements(collection, track)) {
			setPropertyIfChanged(element, trackProperty(track), null);
		}
	}
	for (const image of collection.querySelectorAll<HTMLElement>(IMAGE_TRACK_SELECTOR)) {
		setPropertyIfChanged(image, IMAGE_TRACK_PROPERTY, null);
	}
	for (const card of cards) {
		delete card.dataset.giftCardImageCrowded;
	}
	delete collection.dataset.giftCardTracksAligned;
}

function rectanglesIntersect(first: DOMRect, second: DOMRect): boolean {
	return (
		first.left < second.right &&
		first.right > second.left &&
		first.top < second.bottom &&
		first.bottom > second.top
	);
}

function crowdedTopZoneCards(cards: readonly HTMLElement[]): HTMLElement[] {
	return cards.filter((card) => {
		const category = card.querySelector<HTMLElement>('[data-testid="gift-category-badge"]');
		const like =
			card.querySelector<HTMLElement>('[data-like-heart]')?.closest<HTMLElement>('button') ??
			null;
		return (
			category !== null &&
			like !== null &&
			rectanglesIntersect(category.getBoundingClientRect(), like.getBoundingClientRect())
		);
	});
}

function suspendTrackHeights(collection: HTMLElement, cards: readonly HTMLElement[]): void {
	collection.setAttribute(MEASURING_ATTRIBUTE, '');
	for (const card of cards) {
		delete card.dataset.giftCardImageCrowded;
	}
	delete collection.dataset.giftCardTracksAligned;
}

function visibleChildrenBounds(element: HTMLElement | null): DOMRect[] {
	return element === null
		? []
		: Array.from(element.children, (child) =>
				(child as HTMLElement).getBoundingClientRect(),
			).filter((rect) => rect.width > 0 && rect.height > 0);
}

interface ImageFrameMeasurement {
	readonly image: HTMLElement;
	readonly requiredHeight: number;
	/** Border and bottom padding around the image track, subtracted from the frame height. */
	readonly verticalChrome: number;
}

function measureImageFrame(card: HTMLElement, zoneGap: number): ImageFrameMeasurement | null {
	const image = card.querySelector<HTMLElement>(IMAGE_TRACK_SELECTOR);
	if (image === null) {
		return null;
	}
	const imageRect = image.getBoundingClientRect();
	const imageStyle = getComputedStyle(image);
	const verticalChrome =
		Number.parseFloat(imageStyle.borderTopWidth) +
		Number.parseFloat(imageStyle.borderBottomWidth) +
		Number.parseFloat(imageStyle.paddingBottom);
	// The frame is content-box, so its computed width is the layout width without the transform an
	// entering gift scales in with; the rectangles below are scaled back by the same factor.
	const contentWidth =
		Number.parseFloat(imageStyle.width) +
		Number.parseFloat(imageStyle.paddingLeft) +
		Number.parseFloat(imageStyle.paddingRight);
	const layoutWidth =
		contentWidth +
		Number.parseFloat(imageStyle.borderLeftWidth) +
		Number.parseFloat(imageStyle.borderRightWidth);
	const scale = layoutWidth > 0 && imageRect.width > 0 ? imageRect.width / layoutWidth : 1;
	const naturalHeight = contentWidth * 0.75 + verticalChrome;
	const topBounds = visibleChildrenBounds(
		image.querySelector<HTMLElement>('[data-gift-card-top-overlays]'),
	);
	const stateBounds = visibleChildrenBounds(
		image.querySelector<HTMLElement>('[data-testid="gift-state-overlay"]'),
	);
	const priority = image.querySelector<HTMLElement>('[data-testid="gift-priority-badge"]');
	const priorityRect = priority?.getBoundingClientRect();
	const topExtent = Math.max(0, ...topBounds.map((rect) => rect.bottom - imageRect.top));
	const bottomExtent =
		priorityRect === undefined || priorityRect.width === 0
			? 0
			: imageRect.bottom - priorityRect.top;
	const stateHeight =
		stateBounds.length === 0
			? 0
			: Math.max(...stateBounds.map((rect) => rect.bottom)) -
				Math.min(...stateBounds.map((rect) => rect.top));
	const requiredHeight = Math.max(
		naturalHeight,
		(2 * Math.max(topExtent, bottomExtent) + stateHeight) / scale + zoneGap * 2,
	);
	return { image, requiredHeight, verticalChrome };
}

function imageTrackHeights(
	cards: readonly HTMLElement[],
	alignAcrossCollection: boolean,
): Map<HTMLElement, string> {
	const zoneGap = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) * 0.5;
	const measurements = cards
		.map((card) => measureImageFrame(card, zoneGap))
		.filter((measurement): measurement is ImageFrameMeasurement => measurement !== null);
	const sharedHeight = Math.max(0, ...measurements.map(({ requiredHeight }) => requiredHeight));
	const values = new Map<HTMLElement, string>();
	for (const { image, requiredHeight, verticalChrome } of measurements) {
		const height = alignAcrossCollection ? sharedHeight : requiredHeight;
		values.set(image, `${height - verticalChrome}px`);
	}
	return values;
}

/** The used height ignores the transform an entering gift scales in with, unlike its rectangle. */
function layoutHeight(element: HTMLElement): number {
	const height = Number.parseFloat(getComputedStyle(element).height);
	return Number.isNaN(height) ? element.getBoundingClientRect().height : height;
}

function naturalTrackHeight(elements: readonly HTMLElement[]): number {
	return Math.max(0, ...elements.map(layoutHeight));
}

function measureGiftCardCollectionLayout(collection: HTMLElement): void {
	if (collection.dataset.viewMode !== undefined && collection.dataset.viewMode !== 'card') {
		return;
	}
	// A drag only reorders cards, which keeps every track height; its end measures again.
	if (collection.querySelector(`[${GIFT_MOTION_DRAGGING_ATTRIBUTE}]`) !== null) {
		return;
	}
	const cards = cardElements(collection);
	suspendTrackHeights(collection, cards);
	const hasDescriptions =
		collection.querySelector(
			'[data-gift-card-track="description"][data-has-content="true"]',
		) === null
			? 'false'
			: 'true';
	if (collection.dataset.giftCardHasDescriptions !== hasDescriptions) {
		collection.dataset.giftCardHasDescriptions = hasDescriptions;
	}
	// The text tracks ignore the image zone, so they share the first layout with the crowding check;
	// only the image pass must wait for the crowded flags, which rewrap the top overlays.
	const alignAcrossCollection = gridHasMultipleColumns(collection, cards);
	const crowdedCards = crowdedTopZoneCards(cards);
	const tracks = GIFT_CARD_TRACKS.map((track) => {
		const elements = trackElements(collection, track);
		return {
			track,
			elements,
			height: alignAcrossCollection ? `${naturalTrackHeight(elements)}px` : null,
		};
	});
	for (const card of crowdedCards) {
		card.dataset.giftCardImageCrowded = 'true';
	}
	const imageHeights = imageTrackHeights(cards, alignAcrossCollection);

	collection.removeAttribute(MEASURING_ATTRIBUTE);
	for (const [image, height] of imageHeights) {
		setPropertyIfChanged(image, IMAGE_TRACK_PROPERTY, height);
	}
	for (const { track, elements, height } of tracks) {
		for (const element of elements) {
			setPropertyIfChanged(element, trackProperty(track), height);
		}
	}
	if (alignAcrossCollection) {
		collection.dataset.giftCardTracksAligned = 'true';
	}
}

const immediateMeasurements = new WeakMap<HTMLElement, () => void>();

/**
 * Measures now, for callers such as motion that need the final layout synchronously, and absorbs
 * the frame the collection's observers already scheduled for the same DOM changes.
 */
export function measureGiftCardCollectionLayoutNow(collection: HTMLElement): void {
	const measure = immediateMeasurements.get(collection);
	if (measure === undefined) {
		measureGiftCardCollectionLayout(collection);
	} else {
		measure();
	}
}

export function giftCardCollectionLayout(collection: HTMLElement) {
	let animationFrame = 0;
	let destroyed = false;
	let observedWidth = collection.getBoundingClientRect().width;

	function scheduleMeasurement(): void {
		if (destroyed || animationFrame !== 0) {
			return;
		}
		animationFrame = requestAnimationFrame(() => {
			animationFrame = 0;
			measureGiftCardCollectionLayout(collection);
		});
	}

	function measureNow(): void {
		cancelAnimationFrame(animationFrame);
		animationFrame = 0;
		// Mutations recorded so far are covered by this measurement.
		mutationObserver.takeRecords();
		measureGiftCardCollectionLayout(collection);
	}

	const resizeObserver = new ResizeObserver(([entry]) => {
		const nextWidth = entry?.contentRect.width ?? collection.getBoundingClientRect().width;
		if (nextWidth === observedWidth) {
			return;
		}
		observedWidth = nextWidth;
		scheduleMeasurement();
	});
	resizeObserver.observe(collection);

	const mutationObserver = new MutationObserver((records) => {
		if (mutationsMayChangeCardLayout(records)) {
			scheduleMeasurement();
		}
	});
	mutationObserver.observe(collection, {
		subtree: true,
		childList: true,
		characterData: true,
		attributes: true,
		attributeFilter: [
			'class',
			'hidden',
			'aria-hidden',
			'data-overflow-actions',
			GIFT_MOTION_DRAGGING_ATTRIBUTE,
		],
	});

	immediateMeasurements.set(collection, measureNow);

	const fonts = document.fonts;
	fonts?.addEventListener('loadingdone', scheduleMeasurement);
	window.addEventListener('resize', scheduleMeasurement);
	const stopObservingDepth = observeDepthChange(scheduleMeasurement);
	void fonts?.ready.then(scheduleMeasurement);
	scheduleMeasurement();

	return {
		update() {
			scheduleMeasurement();
		},
		destroy() {
			destroyed = true;
			immediateMeasurements.delete(collection);
			cancelAnimationFrame(animationFrame);
			resizeObserver.disconnect();
			mutationObserver.disconnect();
			fonts?.removeEventListener('loadingdone', scheduleMeasurement);
			window.removeEventListener('resize', scheduleMeasurement);
			stopObservingDepth();
			removeTrackHeights(collection, cardElements(collection));
			delete collection.dataset.giftCardHasDescriptions;
		},
	};
}
