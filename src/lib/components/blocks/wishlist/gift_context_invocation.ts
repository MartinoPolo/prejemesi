import type { GiftContextAction } from '$lib/modules/gifts/gift_context_actions.js';

export interface GiftActionPlacementSnapshot {
	visibleDirectActions: readonly GiftContextAction[];
	pendingActions: readonly GiftContextAction[];
	disabledActions: readonly GiftContextAction[];
}

export type GiftContextInvocation =
	| { kind: 'native'; point: { x: number; y: number } }
	| { kind: 'longpress' }
	| { kind: 'more'; anchor: HTMLButtonElement; placementSnapshot: GiftActionPlacementSnapshot };

export type GiftContextSurface = 'menu' | 'sheet';

export interface GiftContextSession<Gift> {
	id: number;
	gift: Gift;
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
