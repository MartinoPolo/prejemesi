import type { Snippet } from 'svelte';
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
	/** Opens the gift editor at its linked copies; omitted when the viewer cannot edit the gift. */
	oneditlinkedcopies?: () => void;
	/**
	 * Gift editor preview: everything but this image content turns inert. `over` lays it above
	 * the photo and its badges; `instead` replaces the photo and keeps the badges above it.
	 */
	editorImage?: GiftEditorImage;
}

export const GIFT_EDITOR_IMAGE_PLACEMENTS = { over: 'over', instead: 'instead' } as const;

export interface GiftEditorImage {
	content: Snippet;
	placement: (typeof GIFT_EDITOR_IMAGE_PLACEMENTS)[keyof typeof GIFT_EDITOR_IMAGE_PLACEMENTS];
}
