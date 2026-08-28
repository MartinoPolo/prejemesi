import {
	createHiddenReceivedMotion,
	type HiddenReceivedMotionSnapshot,
} from './hidden_received_motion.js';
import {
	createIdentityLayoutMotion,
	type LayoutMotionSnapshot,
} from '$lib/motion/layout_motion.js';

const STANDARD_EASING = 'cubic-bezier(0.2, 0.7, 0.3, 1)';
const CROSS_SECTION_DURATION = 650;
const COMPACT_VIEWPORT_QUERY = '(width < 768px)';

interface Rectangle {
	left: number;
	top: number;
	width: number;
	height: number;
}

export interface GiftReceivedMotionSnapshot {
	readonly run: number;
	readonly giftId: string;
	readonly sourceRectangle: Rectangle | null;
	readonly layout: LayoutMotionSnapshot;
	readonly hidden: HiddenReceivedMotionSnapshot | null;
	readonly invokingControl: HTMLElement | null;
	readonly fallbackControl: HTMLElement | null;
	readonly retainedVisual: HTMLElement | null;
}

interface GiftReceivedMotionOptions {
	reducedMotion?: () => boolean;
	compactViewport?: () => boolean;
}

function visibleRectangle(element: HTMLElement): Rectangle | null {
	const rectangle = element.getBoundingClientRect();
	if (
		!element.isConnected ||
		element.hidden ||
		rectangle.width <= 0 ||
		rectangle.height <= 0 ||
		(rectangle.left === 0 && rectangle.top === 0)
	) {
		return null;
	}
	const style = getComputedStyle(element);
	if (style.display === 'none' || style.visibility === 'hidden') {
		return null;
	}
	return {
		left: rectangle.left,
		top: rectangle.top,
		width: rectangle.width,
		height: rectangle.height,
	};
}

function giftElement(root: ParentNode, giftId: string): HTMLElement | null {
	for (const element of root.querySelectorAll<HTMLElement>('[data-gift-item][data-gift-id]')) {
		if (element.dataset.giftId === giftId) {
			return element;
		}
	}
	return null;
}

function receivedAction(gift: HTMLElement, giftId: string): HTMLElement | null {
	for (const element of gift.querySelectorAll<HTMLElement>('[data-gift-received-action]')) {
		if (element.dataset.giftReceivedAction === giftId) {
			return element;
		}
	}
	return null;
}

function stableFallback(root: ParentNode): HTMLElement | null {
	return root.querySelector<HTMLElement>(
		'[data-testid="wishlist-toolbar"] button:not(:disabled), [data-testid="wishlist-toolbar"] [href]',
	);
}

function clearVisual(visual: HTMLElement) {
	visual.remove();
	visual.style.cssText = '';
	if (visual.hasAttribute('style')) {
		visual.attributes.removeNamedItem('style');
	}
}

export function createGiftReceivedMotion(options: GiftReceivedMotionOptions = {}) {
	const reducedMotion =
		options.reducedMotion ??
		(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
	const compactViewport =
		options.compactViewport ??
		(() => window.matchMedia?.(COMPACT_VIEWPORT_QUERY).matches ?? false);
	const layoutMotion = createIdentityLayoutMotion({ reducedMotion });
	const hiddenMotion = createHiddenReceivedMotion({ reducedMotion });
	let run = 0;
	let activeFlight: Animation | null = null;
	const concealedDestinations = new Map<
		HTMLElement,
		{ opacity: string; priority: string; hadStyle: boolean }
	>();

	function concealDestination(destination: HTMLElement) {
		if (concealedDestinations.has(destination)) {
			return;
		}
		concealedDestinations.set(destination, {
			opacity: destination.style.getPropertyValue('opacity'),
			priority: destination.style.getPropertyPriority('opacity'),
			hadStyle: destination.hasAttribute('style'),
		});
		destination.style.setProperty('opacity', '0', 'important');
	}

	function restoreDestinations() {
		for (const [destination, previous] of concealedDestinations) {
			if (previous.opacity === '') {
				destination.style.removeProperty('opacity');
			} else {
				destination.style.setProperty('opacity', previous.opacity, previous.priority);
			}
			if (!previous.hadStyle && destination.getAttribute('style') === '') {
				destination.removeAttribute('style');
			}
		}
		concealedDestinations.clear();
	}

	function cancel() {
		run += 1;
		activeFlight?.cancel();
		activeFlight = null;
		layoutMotion.cancel();
		hiddenMotion.cancel();
		restoreDestinations();
	}

	function restoreFocus(snapshot: GiftReceivedMotionSnapshot) {
		const target = snapshot.invokingControl?.isConnected
			? snapshot.invokingControl
			: snapshot.fallbackControl?.isConnected
				? snapshot.fallbackControl
				: null;
		target?.focus({ preventScroll: true });
	}

	function capture(
		giftId: string,
		source: HTMLElement,
		root: ParentNode,
	): GiftReceivedMotionSnapshot {
		cancel();
		const layout = layoutMotion.capture(root);
		const invokingControl = receivedAction(source, giftId);
		const fallbackControl = stableFallback(root);
		const sourceRectangle = source.dataset.giftId === giftId ? visibleRectangle(source) : null;
		const hidden = sourceRectangle === null ? null : hiddenMotion.capture(source, root);
		return {
			run,
			giftId,
			sourceRectangle,
			layout,
			hidden,
			invokingControl,
			fallbackControl,
			retainedVisual: hidden?.retainedVisual ?? null,
		};
	}

	function discard(snapshot: GiftReceivedMotionSnapshot) {
		if (snapshot.run !== run) {
			return;
		}
		cancel();
		restoreFocus(snapshot);
	}

	async function play(snapshot: GiftReceivedMotionSnapshot, root: ParentNode): Promise<boolean> {
		if (snapshot.run !== run) {
			return false;
		}
		const destination = giftElement(root, snapshot.giftId);
		const destinationRectangle = destination === null ? null : visibleRectangle(destination);
		const destinationAction =
			destination === null ? null : receivedAction(destination, snapshot.giftId);

		if (reducedMotion()) {
			restoreDestinations();
			if (snapshot.retainedVisual !== null) {
				clearVisual(snapshot.retainedVisual);
			}
			(destinationAction ?? snapshot.fallbackControl)?.focus({ preventScroll: true });
			return snapshot.run === run;
		}

		const canFly =
			!compactViewport() &&
			snapshot.sourceRectangle !== null &&
			destinationRectangle !== null &&
			snapshot.retainedVisual !== null;

		if (!canFly) {
			if (snapshot.hidden !== null) {
				if (destination !== null && snapshot.retainedVisual !== null) {
					concealDestination(destination);
				}
				await hiddenMotion.play(snapshot.hidden, root, true);
				restoreDestinations();
			}
			if (snapshot.run !== run) {
				return false;
			}
			if (destinationAction !== null) {
				destinationAction.focus({ preventScroll: true });
			} else {
				restoreFocus(snapshot);
			}
			return true;
		}

		const sourceRectangle = snapshot.sourceRectangle;
		const visual = snapshot.retainedVisual;
		concealDestination(destination!);
		visual.ownerDocument.body.append(visual);
		const translateX = destinationRectangle.left - sourceRectangle.left;
		const translateY = destinationRectangle.top - sourceRectangle.top;
		const scaleX = destinationRectangle.width / sourceRectangle.width;
		const scaleY = destinationRectangle.height / sourceRectangle.height;
		const flight = visual.animate(
			[
				{ transform: 'translate(0px, 0px) scale(1, 1)' },
				{
					transform: `translate(${translateX}px, ${translateY}px) scale(${scaleX}, ${scaleY})`,
				},
			],
			{ duration: CROSS_SECTION_DURATION, easing: STANDARD_EASING, fill: 'both' },
		);
		activeFlight = flight;
		const flightSettlement = flight.finished
			.catch(() => undefined)
			.then(() => clearVisual(visual));
		await Promise.all([
			flightSettlement,
			layoutMotion.play(snapshot.layout, root, null, {
				excludeGiftIds: new Set([snapshot.giftId]),
			}),
		]);
		if (activeFlight === flight) {
			activeFlight = null;
		}
		restoreDestinations();
		if (snapshot.run !== run) {
			return false;
		}
		destinationAction?.focus({ preventScroll: true });
		return true;
	}

	function destroy() {
		cancel();
		layoutMotion.destroy();
		hiddenMotion.destroy();
	}

	return { capture, play, discard, cancel, destroy };
}
