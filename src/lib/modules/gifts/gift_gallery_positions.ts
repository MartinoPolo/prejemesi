import { getContext, hasContext, setContext } from 'svelte';

const GIFT_GALLERY_POSITIONS_KEY = Symbol('gift-gallery-positions');

/**
 * The image each mounted gift card currently shows, so the Gift viewer opens on it. Client-only
 * browsing state: it is never persisted and resets on reload.
 */
class GiftGalleryPositions {
	#indexes = new Map<string, number>();

	remember(giftId: string, index: number): void {
		this.#indexes.set(giftId, index);
	}

	forget(giftId: string): void {
		this.#indexes.delete(giftId);
	}

	indexOf(giftId: string): number {
		return this.#indexes.get(giftId) ?? 0;
	}
}

/** Shares card gallery positions with the Gift viewer opened from the same page. */
export function provideGiftGalleryPositions(): GiftGalleryPositions {
	return setContext(GIFT_GALLERY_POSITIONS_KEY, new GiftGalleryPositions());
}

/** The page's gallery positions; undefined where cards cannot open a viewer. */
export function useGiftGalleryPositions(): GiftGalleryPositions | undefined {
	return hasContext(GIFT_GALLERY_POSITIONS_KEY)
		? getContext<GiftGalleryPositions>(GIFT_GALLERY_POSITIONS_KEY)
		: undefined;
}
