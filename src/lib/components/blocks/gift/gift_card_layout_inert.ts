/** Marks gift card subtrees whose mutations never change card layout, such as gallery browsing. */
export const GIFT_CARD_LAYOUT_INERT_ATTRIBUTE = 'data-gift-card-layout-inert';

function insideLayoutInertSubtree(node: Node): boolean {
	const element = node instanceof Element ? node : node.parentElement;
	return element?.closest(`[${GIFT_CARD_LAYOUT_INERT_ATTRIBUTE}]`) != null;
}

/** False when every mutation happened inside a layout-inert subtree, such as gallery browsing. */
export function mutationsMayChangeCardLayout(records: readonly MutationRecord[]): boolean {
	return records.some((record) => !insideLayoutInertSubtree(record.target));
}
