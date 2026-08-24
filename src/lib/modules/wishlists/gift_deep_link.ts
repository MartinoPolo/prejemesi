import { WISHLIST_GIFT_QUERY_PARAM } from './wishlist_query_params.js';

interface GiftReference {
	id: string;
}

interface ConsumeGiftDeepLinkOptions<TGift extends GiftReference> {
	url: URL;
	gifts: readonly TGift[];
	canOpen?: boolean;
	onConsume: (cleanedUrl: URL) => void;
	onOpen: (gift: TGift) => void;
}

/**
 * Consumes a wishlist gift marker before opening its matching gift.
 *
 * Removing the marker first makes opening one-shot even when opening the dialog triggers
 * additional reactive updates. Missing gifts and links received while another gift dialog is
 * open are consumed without opening anything.
 */
export function consumeGiftDeepLink<TGift extends GiftReference>({
	url,
	gifts,
	canOpen = true,
	onConsume,
	onOpen,
}: ConsumeGiftDeepLinkOptions<TGift>): void {
	const requestedGiftId = url.searchParams.get(WISHLIST_GIFT_QUERY_PARAM);
	if (requestedGiftId === null) {
		return;
	}

	const cleanedUrl = new URL(url);
	cleanedUrl.searchParams.delete(WISHLIST_GIFT_QUERY_PARAM);
	onConsume(cleanedUrl);

	if (!canOpen) {
		return;
	}
	const matchedGift = gifts.find((gift) => gift.id === requestedGiftId);
	if (matchedGift !== undefined) {
		onOpen(matchedGift);
	}
}
