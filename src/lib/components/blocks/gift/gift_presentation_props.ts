import type { GiftActionPlacementSnapshot } from '$lib/components/blocks/wishlist/gift_context_invocation.js';
import type { GiftByRole, GiftForVisitor } from '$lib/modules/gifts/types.js';
import type { WishlistRole } from '$lib/modules/wishlists/types.js';

/** Action handlers a gift presentation forwards to its browse actions footer. */
export interface GiftBrowseActionHandlers {
	onreserve?: (gift: GiftForVisitor) => void;
	onunreserve?: (gift: GiftForVisitor) => void;
	onreceived?: (giftId: string, received: boolean) => void;
	onmore?: (anchor: HTMLButtonElement, placementSnapshot: GiftActionPlacementSnapshot) => void;
}

/** Props shared by the image-bearing gift presentations: the Card and the List item. */
export interface GiftPresentationProps extends GiftBrowseActionHandlers {
	gift: GiftByRole;
	role: WishlistRole;
	isArchived?: boolean;
	hideReservationState?: boolean;
	contextualMode?: boolean;
	receivedPending?: boolean;
	persistentMore?: boolean;
	moreOpen?: boolean;
	moreSurface?: 'menu' | 'dialog';
	showPriority?: boolean;
	/** Defaults to hidden in contextual mode; grouped reorder reveals it on the dragged gift. */
	showCategory?: boolean;
}
