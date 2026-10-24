function isUsableFocusTarget(element: HTMLButtonElement): boolean {
	return (
		element.isConnected &&
		!element.disabled &&
		element.getClientRects().length > 0 &&
		element.closest('[inert], [aria-hidden="true"]') === null
	);
}

/**
 * Resolve the More action for the gift that opened a context surface. Gift ids are
 * compared through dataset values rather than interpolated into a CSS selector.
 */
export function resolveGiftContextFocusTarget(
	originalAnchor: HTMLButtonElement,
	giftId: string,
	root: ParentNode,
): HTMLButtonElement | null {
	if (isUsableFocusTarget(originalAnchor)) {
		return originalAnchor;
	}
	return firstUsableGiftButton(root, giftId, 'button[data-gift-action="more"]');
}

/** Resolve the reorder grip of the gift whose menu started reorder mode. */
export function resolveGiftReorderGripFocusTarget(
	giftId: string,
	root: ParentNode,
): HTMLButtonElement | null {
	return firstUsableGiftButton(root, giftId, 'button[data-gift-reorder-grip]');
}

function firstUsableGiftButton(
	root: ParentNode,
	giftId: string,
	buttonSelector: string,
): HTMLButtonElement | null {
	for (const giftItem of root.querySelectorAll<HTMLElement>('[data-gift-item][data-gift-id]')) {
		if (giftItem.dataset.giftId !== giftId) {
			continue;
		}
		for (const candidate of giftItem.querySelectorAll<HTMLButtonElement>(buttonSelector)) {
			if (isUsableFocusTarget(candidate)) {
				return candidate;
			}
		}
	}

	return null;
}
