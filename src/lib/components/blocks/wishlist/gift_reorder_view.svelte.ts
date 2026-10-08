import { tick } from 'svelte';
import * as m from '$lib/paraglide/messages.js';
import type { GiftSection } from '$lib/modules/gifts/gift_ordering.js';
import { GIFT_GROUPING_OPTIONS, type GiftGroupingOption } from '$lib/modules/gifts/types.js';
import {
	GIFT_REORDER_MOVE_SOURCES,
	keyboardReorderPlacement,
	type GiftReorderMoveSource,
	type GiftReorderPlacement,
} from '$lib/modules/gifts/gift_grouped_reorder.js';
import {
	createGiftPointerReorderController,
	GIFT_REORDER_GROUP_ATTRIBUTE,
} from './gift_pointer_reorder.svelte.js';
import { groupedReorderKeyboardMove } from './gift_grouped_reorder_keyboard.js';
import {
	GIFT_DISPLAY_ROW_KINDS,
	countGiftsInSections,
	toGiftDisplayRows,
	type GiftDisplayRow,
} from './gift_section_rows.js';

/** Zero-based position of a gift within its reorder group, and that group's size. */
export interface GiftReorderGroupPosition {
	index: number;
	total: number;
}

/** Reports whether the page accepted the placement; only accepted moves are announced. */
export type GiftReorderPlacementCommitHandler = (
	placement: GiftReorderPlacement,
	source: GiftReorderMoveSource,
) => boolean;

interface GiftReorderViewOptions {
	getContainer: () => HTMLElement | null;
	getSections: () => readonly GiftSection[];
	isReorderEnabled: () => boolean;
	/** Grouping kept while reordering; anything but none makes moves group-aware placements. */
	getReorderGrouping: () => GiftGroupingOption;
	onPreviewOrder: (orderedIds: string[]) => void;
	onCommitOrder: (orderedIds: string[]) => void;
	onCancelOrder: (orderedIds: string[]) => void;
	onPreviewPlacement: (placement: GiftReorderPlacement) => void;
	onCommitPlacement: GiftReorderPlacementCommitHandler;
	onCancelPlacement: () => void;
}

export type GiftDisplayGiftRow = Extract<
	GiftDisplayRow,
	{ kind: typeof GIFT_DISPLAY_ROW_KINDS.gift }
>;

/** Marks the reorder grip, the keyboard home of a gift while reordering. */
const GIFT_REORDER_GRIP_ATTRIBUTE = 'data-gift-reorder-grip';

/**
 * A keyed each relocates a gift that moves later in the list by reinserting its element, and the
 * browser blurs a focused control it removes. Refocus the control that started the move, or the
 * gift's grip once that control has become disabled at the list edge.
 */
async function restoreFocusAfterMove(focusedControl: Element | null) {
	if (!(focusedControl instanceof HTMLElement)) {
		return;
	}
	await tick();
	const focusLost = document.activeElement === null || document.activeElement === document.body;
	if (!focusLost || !focusedControl.isConnected) {
		return;
	}
	focusedControl.focus();
	if (document.activeElement !== focusedControl) {
		focusedControl
			.closest('[data-gift-item]')
			?.querySelector<HTMLElement>(`[${GIFT_REORDER_GRIP_ATTRIBUTE}]`)
			?.focus();
	}
}

/**
 * Reorder wiring shared by the Card grid and the List view: display rows, the pointer controller,
 * keyboard/button moves with their screen-reader announcement, and grouped-reorder item props.
 * Call during component initialisation; it registers the controller's cleanup effects.
 */
export function createGiftReorderView(options: GiftReorderViewOptions) {
	let announcement = $state('');
	const groupedReorder = $derived(
		options.isReorderEnabled() && options.getReorderGrouping() !== GIFT_GROUPING_OPTIONS.none,
	);
	const displayRows = $derived(toGiftDisplayRows(options.getSections(), groupedReorder));
	const totalGiftCount = $derived(countGiftsInSections(options.getSections()));

	function getItemElements(): HTMLElement[] {
		const container = options.getContainer();
		return container === null
			? []
			: Array.from(container.querySelectorAll<HTMLElement>('[data-gift-item]'));
	}

	const reorder = createGiftPointerReorderController({
		getItemElements,
		getItemIds: () => getItemElements().map((element) => element.dataset.giftId!),
		onPreviewOrder: options.onPreviewOrder,
		onCommitOrder: options.onCommitOrder,
		onCancelOrder: options.onCancelOrder,
		getGroupTargetElements: () => {
			const container = options.getContainer();
			return container === null
				? []
				: Array.from(
						container.querySelectorAll<HTMLElement>(
							`[${GIFT_REORDER_GROUP_ATTRIBUTE}]`,
						),
					);
		},
		grouped: {
			isActive: () => groupedReorder,
			onPreviewPlacement: options.onPreviewPlacement,
			onCommitPlacement: (placement) => {
				options.onCommitPlacement(placement, GIFT_REORDER_MOVE_SOURCES.pointer);
			},
			onCancelPlacement: options.onCancelPlacement,
		},
	});

	function canMoveWithinGroups(giftId: string, direction: -1 | 1): boolean | undefined {
		return groupedReorder
			? keyboardReorderPlacement(options.getSections(), giftId, direction) !== null
			: undefined;
	}

	function moveGroupedGift(giftId: string, direction: -1 | 1) {
		if (reorder.draggedGiftId.current !== null) {
			return;
		}
		const move = groupedReorderKeyboardMove(options.getSections(), giftId, direction);
		if (
			move !== null &&
			options.onCommitPlacement(move.placement, GIFT_REORDER_MOVE_SOURCES.keyboard)
		) {
			announcement = move.announcement;
		}
	}

	/** One keyboard or button step of the gift at `index` in the flattened display order. */
	function moveGift(index: number, direction: -1 | 1) {
		const focusedControl = document.activeElement;
		applyGiftMove(index, direction);
		void restoreFocusAfterMove(focusedControl);
	}

	function applyGiftMove(index: number, direction: -1 | 1) {
		const movedRow = displayRows.find(
			(row): row is GiftDisplayGiftRow =>
				row.kind === GIFT_DISPLAY_ROW_KINDS.gift && row.index === index,
		);
		if (groupedReorder) {
			if (movedRow !== undefined) {
				moveGroupedGift(movedRow.gift.id, direction);
			}
			return;
		}
		const destination = index + direction;
		if (destination < 0 || destination >= totalGiftCount || !reorder.move(index, direction)) {
			return;
		}
		if (movedRow !== undefined) {
			announcement = m.gift_reorder_move_success({
				name: movedRow.gift.name,
				position: destination + 1,
				total: totalGiftCount,
			});
		}
	}

	function headerGroupKey(section: GiftSection): string | undefined {
		return groupedReorder ? section.key : undefined;
	}

	function giftReorderProps(row: GiftDisplayGiftRow) {
		if (!groupedReorder) {
			return {};
		}
		return {
			reorderGroupKey: row.section.key,
			canMoveBackward: canMoveWithinGroups(row.gift.id, -1),
			canMoveForward: canMoveWithinGroups(row.gift.id, 1),
			groupPosition: {
				index: row.indexInSection,
				total: row.section.gifts.length,
			} satisfies GiftReorderGroupPosition,
		};
	}

	/** Only the dragged gift shows the live badge of the grouping it is being moved within. */
	function groupBadgeProps(giftId: string, showPriority: boolean) {
		const showsDraggedGroupBadge = groupedReorder && reorder.draggedGiftId.current === giftId;
		return {
			showPriority: showPriority || showsDraggedGroupBadge,
			showCategory:
				showsDraggedGroupBadge &&
				options.getReorderGrouping() === GIFT_GROUPING_OPTIONS.category
					? true
					: undefined,
		};
	}

	$effect(() => {
		if (!options.isReorderEnabled()) {
			reorder.cancel();
		}
	});
	$effect(() => () => reorder.destroy());

	return {
		get announcement() {
			return announcement;
		},
		get displayRows() {
			return displayRows;
		},
		get totalGiftCount() {
			return totalGiftCount;
		},
		draggedGiftId: reorder.draggedGiftId,
		dragOverGiftId: reorder.dragOverGiftId,
		startPointerReorder: reorder.start,
		moveGift,
		headerGroupKey,
		giftReorderProps,
		groupBadgeProps,
	};
}
