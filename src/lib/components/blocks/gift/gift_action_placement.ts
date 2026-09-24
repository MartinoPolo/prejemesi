import type { GiftContextAction } from '$lib/modules/gifts/gift_context_actions.js';

export interface MeasuredGiftAction {
	id: GiftContextAction;
	width: number;
}

export interface GiftActionPlacementInput {
	contentWidth: number;
	secondary?: MeasuredGiftAction;
	primary?: MeasuredGiftAction;
	moreWidth: number;
	gap: number;
	persistentMore: boolean;
}

export interface GiftActionPlacement {
	showSecondary: boolean;
	showPrimary: boolean;
	showMore: boolean;
	overflowActions: readonly GiftContextAction[];
}

function requiredWidth(widths: readonly number[], gap: number): number {
	return widths.reduce((total, width) => total + width, 0) + Math.max(0, widths.length - 1) * gap;
}

export function placeGiftActions(input: Readonly<GiftActionPlacementInput>): GiftActionPlacement {
	const visibleActions = [input.secondary, input.primary].filter(
		(action): action is MeasuredGiftAction => action !== undefined,
	);
	const initialWidths = visibleActions.map((action) => action.width);
	if (input.persistentMore) {
		initialWidths.push(input.moreWidth);
	}

	if (requiredWidth(initialWidths, input.gap) <= input.contentWidth) {
		return {
			showSecondary: input.secondary !== undefined,
			showPrimary: input.primary !== undefined,
			showMore: input.persistentMore,
			overflowActions: [],
		};
	}

	const overflowActions: GiftContextAction[] = [];
	if (input.secondary !== undefined) {
		overflowActions.push(input.secondary.id);
	}
	return {
		showSecondary: false,
		showPrimary: input.primary !== undefined,
		showMore: true,
		overflowActions,
	};
}
