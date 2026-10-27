import type { GiftContextAction } from '$lib/modules/gifts/gift_context_actions.js';
import type { GiftContextOrigin } from '$lib/modules/wishlists/wishlist_capabilities.js';

export interface GiftActionPlacementSnapshot {
	visibleDirectActions: readonly GiftContextAction[];
	pendingActions: readonly GiftContextAction[];
	disabledActions: readonly GiftContextAction[];
}

export type GiftMoreSurface = 'menu' | 'dialog';

/** An action lane's More button, which opens the page's gift actions for actions that did not fit. */
export interface GiftMoreProps {
	onmore?: (anchor: HTMLButtonElement, placementSnapshot: GiftActionPlacementSnapshot) => void;
	moreOpen?: boolean;
	moreSurface?: GiftMoreSurface;
}

/** A browser context menu request; Shift+F10 and the ContextMenu key arrive `fromKeyboard`. */
interface NativeGiftContextInvocation {
	kind: 'native';
	point: { x: number; y: number };
	fromKeyboard: boolean;
}

export type GiftContextInvocation =
	| NativeGiftContextInvocation
	| { kind: 'longpress' }
	| { kind: 'more'; anchor: HTMLButtonElement; placementSnapshot: GiftActionPlacementSnapshot };

export type GiftContextSurface = 'menu' | 'sheet';

export interface GiftContextSession<Gift> {
	id: number;
	gift: Gift;
	origin: GiftContextOrigin;
	viewportAtOpen: boolean;
	invocation:
		| NativeGiftContextInvocation
		| { kind: 'longpress'; surface: 'sheet' }
		| {
				kind: 'more';
				anchor: HTMLButtonElement;
				surface: GiftContextSurface;
				placementSnapshot: GiftActionPlacementSnapshot;
		  };
}

export type GiftContextFinishPolicy = 'restore-focus' | 'handoff';

/** Gift commands both context-action renderers forward to their owner. */
export interface GiftContextCommandCallbacks {
	onfinish: (policy: GiftContextFinishPolicy, callback: () => void) => void;
	onedit: () => void;
	/** Present only when the AI assistant is offered. */
	onenrich?: () => void;
	onpriority: (id: string | null) => void;
	/** Adds (`checked`) or removes one category; `null` removes every category. */
	oncategory: (id: string | null, checked: boolean) => void;
	/** Present only when the viewer may manage the wishlist's categories. */
	oncreatecategory?: () => void;
	onreceived: () => void;
	onselect: () => void;
	/** Present only while reorder mode can start. */
	onreorder?: () => void;
	onreserve?: () => void;
	oncancelreservation?: () => void;
	onpurchased?: () => void;
	onreleasereservation?: () => void;
}
