import type { GiftContextAction } from '$lib/modules/gifts/gift_context_actions.js';

export interface MeasuredGiftAction {
	id: GiftContextAction;
	width: number;
}

export interface GiftActionPlacementInput {
	contentWidth: number;
	/** Ordered left to right; the leftmost secondary action overflows first. */
	secondary?: readonly MeasuredGiftAction[];
	primary?: MeasuredGiftAction;
	moreWidth: number;
	gap: number;
	persistentMore: boolean;
}

export interface GiftActionPlacement {
	visibleSecondaryActions: readonly GiftContextAction[];
	showPrimary: boolean;
	showMore: boolean;
	overflowActions: readonly GiftContextAction[];
}

function requiredWidth(widths: readonly number[], gap: number): number {
	return widths.reduce((total, width) => total + width, 0) + Math.max(0, widths.length - 1) * gap;
}

/**
 * The primary command never overflows. Secondary actions move into More one at a time, starting
 * with the leftmost, until the remaining direct actions and More fit.
 */
export function placeGiftActions(input: Readonly<GiftActionPlacementInput>): GiftActionPlacement {
	const secondaryActions = input.secondary ?? [];
	const primaryWidths = input.primary === undefined ? [] : [input.primary.width];
	const widthWith = (visibleSecondary: readonly MeasuredGiftAction[], showMore: boolean) =>
		requiredWidth(
			[
				...visibleSecondary.map((action) => action.width),
				...primaryWidths,
				...(showMore ? [input.moreWidth] : []),
			],
			input.gap,
		);

	const overflows = widthWith(secondaryActions, input.persistentMore) > input.contentWidth;
	let overflowCount = overflows ? Math.min(1, secondaryActions.length) : 0;
	while (
		overflowCount > 0 &&
		overflowCount < secondaryActions.length &&
		widthWith(secondaryActions.slice(overflowCount), true) > input.contentWidth
	) {
		overflowCount += 1;
	}

	return {
		visibleSecondaryActions: secondaryActions.slice(overflowCount).map((action) => action.id),
		showPrimary: input.primary !== undefined,
		showMore: input.persistentMore || overflows,
		overflowActions: secondaryActions.slice(0, overflowCount).map((action) => action.id),
	};
}
