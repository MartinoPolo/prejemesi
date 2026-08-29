import {
	createIdentityLayoutMotion,
	type LayoutMotionSnapshot,
} from '$lib/motion/layout_motion.js';

const STANDARD_EASING = 'cubic-bezier(0.2, 0.7, 0.3, 1)';
const LOCAL_EXIT_DURATION = 340;

export interface HiddenReceivedMotionSnapshot {
	readonly run: number;
	readonly layout: LayoutMotionSnapshot;
	readonly retainedVisual: HTMLElement | null;
}

export interface HiddenReceivedMotionOptions {
	reducedMotion?: () => boolean;
}

function stripIds(element: HTMLElement) {
	element.removeAttribute('id');
	for (const descendant of element.querySelectorAll('[id]')) {
		descendant.removeAttribute('id');
	}
}

function createSourceVisual(source: HTMLElement): HTMLElement {
	const rectangle = source.getBoundingClientRect();
	const sourceStyle = getComputedStyle(source);
	const clone = source.cloneNode(true) as HTMLElement;
	// The retained card moves under <body>, outside the wishlist theme scope. Materialize all
	// inherited custom properties so the moving card keeps the exact source palette and styling.
	for (const property of sourceStyle) {
		if (property.startsWith('--')) {
			clone.style.setProperty(property, sourceStyle.getPropertyValue(property));
		}
	}
	stripIds(clone);
	clone.removeAttribute('data-gift-item');
	clone.removeAttribute('data-gift-id');
	clone.setAttribute('aria-hidden', 'true');
	clone.inert = true;
	Object.assign(clone.style, {
		position: 'fixed',
		left: `${rectangle.left}px`,
		top: `${rectangle.top}px`,
		width: `${rectangle.width}px`,
		height: `${rectangle.height}px`,
		margin: '0px',
		boxSizing: 'border-box',
		pointerEvents: 'none',
		transformOrigin: 'center',
		zIndex: '100',
	});
	return clone;
}

export function createHiddenReceivedMotion(options: HiddenReceivedMotionOptions = {}) {
	const reducedMotion =
		options.reducedMotion ??
		(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
	const layoutMotion = createIdentityLayoutMotion({ reducedMotion });
	let run = 0;
	let activeAnimation: Animation | null = null;
	const retainedVisuals = new Set<HTMLElement>();

	function removeRetainedVisual(visual: HTMLElement) {
		visual.remove();
		visual.style.cssText = '';
		if (visual.hasAttribute('style')) {
			visual.attributes.removeNamedItem('style');
		}
		retainedVisuals.delete(visual);
	}

	function removeRetainedVisuals() {
		for (const visual of retainedVisuals) {
			removeRetainedVisual(visual);
		}
	}

	function cancel() {
		run += 1;
		activeAnimation?.cancel();
		activeAnimation = null;
		layoutMotion.cancel();
		removeRetainedVisuals();
	}

	function capture(source: HTMLElement, root: ParentNode): HiddenReceivedMotionSnapshot {
		cancel();
		const layout = layoutMotion.capture(root);
		const retainedVisual = reducedMotion() ? null : createSourceVisual(source);
		if (retainedVisual !== null) {
			retainedVisuals.add(retainedVisual);
		}
		return { run, layout, retainedVisual };
	}

	async function play(
		snapshot: HiddenReceivedMotionSnapshot,
		postUpdateRoot: ParentNode,
		awaitLayout = false,
	) {
		if (snapshot.run !== run || reducedMotion()) {
			if (snapshot.retainedVisual !== null) {
				removeRetainedVisual(snapshot.retainedVisual);
			}
			return;
		}
		const visual = snapshot.retainedVisual;
		if (visual === null) {
			return;
		}
		visual.ownerDocument.body.append(visual);

		const animation = visual.animate(
			[
				{ opacity: 1, transform: 'scale(1)' },
				{ opacity: 0, transform: 'scale(0.97)' },
			],
			{ duration: LOCAL_EXIT_DURATION, easing: STANDARD_EASING, fill: 'both' },
		);
		activeAnimation = animation;
		try {
			await animation.finished;
		} catch {
			// Cancellation is an expected end state for a superseded run.
		}
		if (activeAnimation === animation) {
			activeAnimation = null;
		}
		removeRetainedVisual(visual);
		if (snapshot.run === run) {
			const layoutSettlement = layoutMotion.play(snapshot.layout, postUpdateRoot);
			if (awaitLayout) {
				await layoutSettlement;
			}
		}
	}

	function destroy() {
		cancel();
		layoutMotion.destroy();
	}

	return { capture, play, cancel, destroy };
}
