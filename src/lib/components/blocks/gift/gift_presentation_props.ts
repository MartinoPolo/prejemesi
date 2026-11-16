import type { GiftLivePreviewKind } from '$lib/components/blocks/change-proposals/change_row_model.js';
import type { GiftActionPlacementSnapshot } from '$lib/components/blocks/wishlist/gift_context_invocation.js';
import type { ImageLoadPriority } from '$lib/components/derived/image-frame/index.js';
import type { GiftByRole, GiftForVisitor, GiftUnreserveHandler } from '$lib/modules/gifts/types.js';
import type { WishlistRole } from '$lib/modules/wishlists/types.js';

/** Action handlers a gift presentation forwards to its browse actions footer. */
export interface GiftBrowseActionHandlers {
	onreserve?: (gift: GiftForVisitor) => void;
	onunreserve?: GiftUnreserveHandler;
	onreceived?: (giftId: string, received: boolean) => void;
	onmore?: (anchor: HTMLButtonElement, placementSnapshot: GiftActionPlacementSnapshot) => void;
}

/** Props shared by the gift presentations: the Card and the List item. */
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
	/** How a chat proposal being decided would change the gift. */
	livePreview?: GiftLivePreviewKind;
	/** Eager for gifts likely above the fold, high for the likely LCP image. */
	imageLoadPriority?: ImageLoadPriority;
}
