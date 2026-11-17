import { hasContext, setContext } from 'svelte';

const modalLayerKey = Symbol('modal layer');

/** Marks descendants as rendered inside a dialog or sheet, whose overlay already blocks the page. */
export function markModalLayer() {
	setContext(modalLayerKey, true);
}

export function isInsideModalLayer(): boolean {
	return hasContext(modalLayerKey);
}
