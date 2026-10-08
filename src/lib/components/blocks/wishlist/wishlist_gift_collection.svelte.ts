import type { GiftPresentationProps } from '$lib/components/blocks/gift/gift_presentation_props.js';
import type { GiftSection } from '$lib/modules/gifts/gift_ordering.js';
import type { GiftReorderPlacement } from '$lib/modules/gifts/gift_grouped_reorder.js';
import {
	GIFT_GROUPING_OPTIONS,
	type GiftByRole,
	type GiftForVisitor,
	type GiftGroupingOption,
} from '$lib/modules/gifts/types.js';
import type { WishlistRole } from '$lib/modules/wishlists/types.js';
import type { GiftContextInvocation } from './gift_context_invocation.js';
import {
	createGiftReorderView,
	type GiftDisplayGiftRow,
	type GiftReorderPlacementCommitHandler,
} from './gift_reorder_view.svelte.js';

/** Props shared by the image-bearing gift collections: the Card grid and the List view. */
export interface WishlistGiftCollectionProps {
	sections: GiftSection[];
	role: WishlistRole;
	isArchived: boolean;
	hideReservationState: boolean;
	reorderEnabled: boolean;
	onedit: (gift: GiftByRole) => void;
	onreserve: (gift: GiftForVisitor) => void;
	onunreserve: (gift: GiftForVisitor) => void;
	onreceived: (giftId: string, received: boolean) => void;
	receivedPendingGiftIds?: ReadonlySet<string>;
	onreorderpreview: (orderedIds: string[]) => void;
	onreordercommit: (orderedIds: string[]) => void;
	onreordercancel: (orderedIds: string[]) => void;
	/** Grouping kept while reordering; anything but none makes moves group-aware placements. */
	reorderGrouping?: GiftGroupingOption;
	onreorderplacementpreview?: (placement: GiftReorderPlacement) => void;
	onreorderplacementcommit?: GiftReorderPlacementCommitHandler;
	onreorderplacementcancel?: () => void;
	selectionMode?: boolean;
	onselectiontoggle?: (giftId: string) => void;
	oncontextactions?: (gift: GiftByRole, invocation: GiftContextInvocation) => boolean;
	hascontextactions?: (gift: GiftByRole) => boolean;
	activeContextGiftId?: string | null;
	contextSurface?: 'menu' | 'dialog';
	showPriority?: boolean;
}

/**
 * Collection wiring shared by the Card grid and the List view: reorder state plus the props each
 * section header, gift item and gift presentation receives. Call during component initialisation.
 */
export function createWishlistGiftCollectionView(
	getCollection: () => WishlistGiftCollectionProps,
	getContainer: () => HTMLElement | null,
) {
	const collection = $derived(getCollection());
	const selectionMode = $derived(collection.selectionMode ?? false);
	const reorderView = createGiftReorderView({
		getContainer,
		getSections: () => collection.sections,
		isReorderEnabled: () => collection.reorderEnabled,
		getReorderGrouping: () => collection.reorderGrouping ?? GIFT_GROUPING_OPTIONS.none,
		onPreviewOrder: (orderedIds) => collection.onreorderpreview(orderedIds),
		onCommitOrder: (orderedIds) => collection.onreordercommit(orderedIds),
		onCancelOrder: (orderedIds) => collection.onreordercancel(orderedIds),
		onPreviewPlacement: (placement) => collection.onreorderplacementpreview?.(placement),
		onCommitPlacement: (placement, source) =>
			collection.onreorderplacementcommit?.(placement, source) ?? false,
		onCancelPlacement: () => collection.onreorderplacementcancel?.(),
	});

	function sectionHeaderProps(section: GiftSection) {
		return {
			section,
			selectionMode,
			onselectiontoggle: collection.onselectiontoggle,
			reorderGroupKey: reorderView.headerGroupKey(section),
		};
	}

	function giftItemProps(row: GiftDisplayGiftRow) {
		return {
			gift: row.gift,
			index: row.index,
			totalCount: reorderView.totalGiftCount,
			reorderEnabled: collection.reorderEnabled,
			draggedGiftId: reorderView.draggedGiftId.current,
			dragOverGiftId: reorderView.dragOverGiftId.current,
			selectionMode,
			onselectiontoggle: collection.onselectiontoggle,
			oncontextactions: collection.oncontextactions,
			onedit: collection.onedit,
			onreorderpointerdown: reorderView.startPointerReorder,
			onreordermove: reorderView.moveGift,
			...reorderView.giftReorderProps(row),
		};
	}

	function giftPresentationProps(gift: GiftByRole): GiftPresentationProps {
		const openContextActions = collection.oncontextactions;
		return {
			gift,
			role: collection.role,
			isArchived: collection.isArchived,
			hideReservationState: collection.hideReservationState,
			...reorderView.groupBadgeProps(gift.id, collection.showPriority ?? true),
			contextualMode: selectionMode || collection.reorderEnabled,
			onreserve: collection.onreserve,
			onunreserve: collection.onunreserve,
			onreceived: collection.onreceived,
			receivedPending: collection.receivedPendingGiftIds?.has(gift.id) ?? false,
			moreOpen: collection.activeContextGiftId === gift.id,
			moreSurface: collection.contextSurface ?? 'menu',
			persistentMore: collection.hascontextactions?.(gift) ?? false,
			onmore:
				openContextActions === undefined
					? undefined
					: (anchor, placementSnapshot) =>
							openContextActions(gift, { kind: 'more', anchor, placementSnapshot }),
		};
	}

	return {
		get announcement() {
			return reorderView.announcement;
		},
		get displayRows() {
			return reorderView.displayRows;
		},
		sectionHeaderProps,
		giftItemProps,
		giftPresentationProps,
	};
}
