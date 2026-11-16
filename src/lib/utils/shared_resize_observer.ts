import type { Attachment } from 'svelte/attachments';

/**
 * Reads layout and returns any DOM write instead of performing it, so the writes of every listener
 * run after all reads: a write between reads would force a fresh layout for each element.
 */
type ResizeListener = () => (() => void) | void;

const listenersByElement = new Map<Element, Set<ResizeListener>>();
let sharedResizeObserver: ResizeObserver | null = null;

function notifyResizes(entries: ResizeObserverEntry[]): void {
	// A listener observing several elements re-measures all of them once per delivery.
	const listeners = new Set<ResizeListener>();
	for (const entry of entries) {
		listenersByElement.get(entry.target)?.forEach((listener) => listeners.add(listener));
	}
	const writes: (() => void)[] = [];
	for (const notify of listeners) {
		const write = notify();
		if (write) {
			writes.push(write);
		}
	}
	for (const write of writes) {
		write();
	}
}

/**
 * One observer serves every element, so a collection resize is one callback rather than one per
 * card, and registering never reads layout: the first size arrives with the next rendering update.
 */
export function observeResize(element: Element, listener: ResizeListener): () => void {
	sharedResizeObserver ??= new ResizeObserver(notifyResizes);
	const listeners = listenersByElement.get(element);
	if (listeners === undefined) {
		listenersByElement.set(element, new Set([listener]));
	} else {
		listeners.add(listener);
		// The initial observation was already delivered; observing afresh repeats it for the newcomer.
		sharedResizeObserver.unobserve(element);
	}
	sharedResizeObserver.observe(element);
	return () => {
		const current = listenersByElement.get(element);
		if (current === undefined) {
			return;
		}
		current.delete(listener);
		if (current.size === 0) {
			listenersByElement.delete(element);
			sharedResizeObserver?.unobserve(element);
		}
	};
}

/**
 * Reports the element's client size whenever it resizes. Unlike `bind:clientWidth`, mounting does
 * not read the size synchronously, which forces a layout per element while a list is inserted.
 */
export function clientSize(
	onresize: (size: { width: number; height: number }) => void,
): Attachment<HTMLElement> {
	return (element) =>
		observeResize(element, () => {
			onresize({ width: element.clientWidth, height: element.clientHeight });
		});
}
