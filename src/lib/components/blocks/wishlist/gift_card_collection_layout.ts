const GIFT_CARD_TRACKS = ['title', 'description', 'links', 'price', 'actions'] as const;

type GiftCardTrack = (typeof GIFT_CARD_TRACKS)[number];

const trackProperty = (track: GiftCardTrack) => `--gift-card-${track}-track-height`;

function gridHasMultipleColumns(collection: HTMLElement): boolean {
	const grid = collection.querySelector<HTMLElement>('[data-testid="wishlist-gift-card-grid"]');
	if (grid === null) {
		return false;
	}

	return getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length > 1;
}

function cardElements(collection: HTMLElement): HTMLElement[] {
	return Array.from(
		collection.querySelectorAll<HTMLElement>('[data-testid="gift-card-surface"]'),
	);
}

function resetImageHeights(collection: HTMLElement): void {
	for (const card of cardElements(collection)) {
		card.style.removeProperty('--gift-card-image-track-height');
		delete card.dataset.giftCardImageCrowded;
	}
}

function rectanglesIntersect(first: DOMRect, second: DOMRect): boolean {
	return (
		first.left < second.right &&
		first.right > second.left &&
		first.top < second.bottom &&
		first.bottom > second.top
	);
}

function prepareCrowdedTopZones(collection: HTMLElement): void {
	for (const card of cardElements(collection)) {
		const category = card.querySelector<HTMLElement>('[data-testid="gift-category-badge"]');
		const like =
			card.querySelector<HTMLElement>('[data-like-heart]')?.closest<HTMLElement>('button') ??
			null;
		if (
			category !== null &&
			like !== null &&
			rectanglesIntersect(category.getBoundingClientRect(), like.getBoundingClientRect())
		) {
			card.dataset.giftCardImageCrowded = 'true';
		}
	}
}

function resetTrackHeights(collection: HTMLElement): void {
	for (const track of GIFT_CARD_TRACKS) {
		collection.style.removeProperty(trackProperty(track));
	}
	resetImageHeights(collection);
	delete collection.dataset.giftCardTracksAligned;
}

function visibleChildrenBounds(element: HTMLElement | null): DOMRect[] {
	return element === null
		? []
		: Array.from(element.children, (child) =>
				(child as HTMLElement).getBoundingClientRect(),
			).filter((rect) => rect.width > 0 && rect.height > 0);
}

function requiredImageHeight(card: HTMLElement): number {
	const image = card.querySelector<HTMLElement>('[data-testid="gift-card-image-frame"]');
	if (image === null) {
		return 0;
	}
	const imageRect = image.getBoundingClientRect();
	const imageStyle = getComputedStyle(image);
	const contentWidth =
		imageRect.width -
		Number.parseFloat(imageStyle.borderLeftWidth) -
		Number.parseFloat(imageStyle.borderRightWidth);
	const naturalHeight =
		contentWidth * 0.75 +
		Number.parseFloat(imageStyle.borderTopWidth) +
		Number.parseFloat(imageStyle.borderBottomWidth);
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
	const zoneGap = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) * 0.5;
	return Math.max(
		naturalHeight,
		2 * Math.max(topExtent, bottomExtent) + stateHeight + zoneGap * 2,
	);
}

function applyImageHeights(collection: HTMLElement, alignAcrossCollection: boolean): void {
	const cards = cardElements(collection);
	const requiredHeights = cards.map(requiredImageHeight);
	const sharedHeight = Math.max(0, ...requiredHeights);
	for (const [index, card] of cards.entries()) {
		const height = alignAcrossCollection ? sharedHeight : requiredHeights[index]!;
		const image = card.querySelector<HTMLElement>('[data-testid="gift-card-image-frame"]');
		if (image === null) {
			continue;
		}
		const imageStyle = getComputedStyle(image);
		const contentHeight =
			height -
			Number.parseFloat(imageStyle.borderTopWidth) -
			Number.parseFloat(imageStyle.borderBottomWidth);
		card.style.setProperty('--gift-card-image-track-height', `${contentHeight}px`);
	}
}

function measureTrackHeights(collection: HTMLElement): void {
	resetTrackHeights(collection);
	const hasDescriptions = collection.querySelector(
		'[data-gift-card-track="description"][data-has-content="true"]',
	);
	collection.dataset.giftCardHasDescriptions = hasDescriptions === null ? 'false' : 'true';
	const alignAcrossCollection = gridHasMultipleColumns(collection);
	prepareCrowdedTopZones(collection);
	applyImageHeights(collection, alignAcrossCollection);
	if (!alignAcrossCollection) {
		return;
	}

	const heights = Object.fromEntries(GIFT_CARD_TRACKS.map((track) => [track, 0])) as Record<
		GiftCardTrack,
		number
	>;
	for (const track of GIFT_CARD_TRACKS) {
		for (const element of collection.querySelectorAll<HTMLElement>(
			`[data-gift-card-track="${track}"]`,
		)) {
			heights[track] = Math.max(heights[track], element.getBoundingClientRect().height);
		}
	}

	for (const track of GIFT_CARD_TRACKS) {
		collection.style.setProperty(trackProperty(track), `${heights[track]}px`);
	}
	collection.dataset.giftCardTracksAligned = 'true';
}

export function giftCardCollectionLayout(collection: HTMLElement) {
	let animationFrame = 0;
	let destroyed = false;
	let observedWidth = collection.getBoundingClientRect().width;

	function scheduleMeasurement(): void {
		if (destroyed) {
			return;
		}
		cancelAnimationFrame(animationFrame);
		animationFrame = requestAnimationFrame(() => measureTrackHeights(collection));
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

	const mutationObserver = new MutationObserver(scheduleMeasurement);
	mutationObserver.observe(collection, {
		subtree: true,
		childList: true,
		characterData: true,
		attributes: true,
		attributeFilter: ['class', 'hidden', 'aria-hidden', 'data-overflow-actions'],
	});

	const fonts = document.fonts;
	fonts?.addEventListener('loadingdone', scheduleMeasurement);
	window.addEventListener('resize', scheduleMeasurement);
	void fonts?.ready.then(scheduleMeasurement);
	scheduleMeasurement();

	return {
		update() {
			scheduleMeasurement();
		},
		destroy() {
			destroyed = true;
			cancelAnimationFrame(animationFrame);
			resizeObserver.disconnect();
			mutationObserver.disconnect();
			fonts?.removeEventListener('loadingdone', scheduleMeasurement);
			window.removeEventListener('resize', scheduleMeasurement);
			resetTrackHeights(collection);
			delete collection.dataset.giftCardHasDescriptions;
		},
	};
}
