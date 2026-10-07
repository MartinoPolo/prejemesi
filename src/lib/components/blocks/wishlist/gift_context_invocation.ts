import type {
	GiftContextAction,
	GiftContextOrigin,
} from '$lib/modules/gifts/gift_context_actions.js';

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

export type GiftContextInvocation =
	| { kind: 'native'; point: { x: number; y: number } }
	| { kind: 'longpress' }
	| { kind: 'more'; anchor: HTMLButtonElement; placementSnapshot: GiftActionPlacementSnapshot };

export type GiftContextSurface = 'menu' | 'sheet';

export interface GiftContextSession<Gift> {
	id: number;
	gift: Gift;
	origin: GiftContextOrigin;
	viewportAtOpen: boolean;
	invocation:
		| { kind: 'native'; point: { x: number; y: number } }
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
	onpriority: (id: string | null) => void;
	oncategory: (id: string | null) => void;
	onreceived: () => void;
	onselect: () => void;
	onreserve?: () => void;
	oncancelreservation?: () => void;
	onpurchased?: () => void;
	onreleasereservation?: () => void;
}
