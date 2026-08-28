const STANDARD_EASING = 'cubic-bezier(0.2, 0.7, 0.3, 1)';
const GIFT_REFLOW_DURATION = 520;
const TOOLBAR_REFLOW_DURATION = 320;

interface Position {
	left: number;
	top: number;
}

export interface LayoutMotionSnapshot {
	readonly run: number;
	readonly gifts: ReadonlyMap<string, Position>;
	readonly toolbarHeight: number | null;
}

interface IdentityLayoutMotionOptions {
	reducedMotion?: () => boolean;
}

function isVisibleRectangle(element: HTMLElement, rectangle: DOMRect): boolean {
	if (!element.isConnected || element.hidden || rectangle.width <= 0 || rectangle.height <= 0) {
		return false;
	}
	const style = getComputedStyle(element);
	return (
		style.display !== 'none' &&
		style.visibility !== 'hidden' &&
		!(rectangle.left === 0 && rectangle.top === 0)
	);
}

function captureGifts(root: ParentNode): Map<string, Position> {
	const positions = new Map<string, Position>();
	for (const element of root.querySelectorAll<HTMLElement>('[data-gift-item]')) {
		const id = element.dataset.giftId;
		if (id === undefined || id === '') {
			continue;
		}
		const rectangle = element.getBoundingClientRect();
		if (isVisibleRectangle(element, rectangle)) {
			positions.set(id, { left: rectangle.left, top: rectangle.top });
		}
	}
	return positions;
}

export function createIdentityLayoutMotion(options: IdentityLayoutMotionOptions = {}) {
	const reducedMotion =
		options.reducedMotion ??
		(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
	let run = 0;
	const animations = new Set<Animation>();

	function cancel() {
		run += 1;
		for (const activeAnimation of animations) {
			activeAnimation.cancel();
		}
		animations.clear();
	}

	function track(animation: Animation) {
		animations.add(animation);
		animation.addEventListener?.('finish', () => animations.delete(animation), { once: true });
		animation.addEventListener?.('cancel', () => animations.delete(animation), { once: true });
	}

	function capture(root: ParentNode, toolbar?: HTMLElement | null): LayoutMotionSnapshot {
		cancel();
		return {
			run,
			gifts: captureGifts(root),
			toolbarHeight: toolbar?.isConnected ? toolbar.getBoundingClientRect().height : null,
		};
	}

	function play(snapshot: LayoutMotionSnapshot, root: ParentNode, toolbar?: HTMLElement | null) {
		if (snapshot.run !== run || reducedMotion()) {
			return;
		}

		if (toolbar?.isConnected && snapshot.toolbarHeight !== null) {
			const nextHeight = toolbar.getBoundingClientRect().height;
			if (nextHeight > 0 && nextHeight !== snapshot.toolbarHeight) {
				track(
					toolbar.animate(
						[
							{ height: `${snapshot.toolbarHeight}px`, overflow: 'clip' },
							{ height: `${nextHeight}px`, overflow: 'clip' },
						],
						{ duration: TOOLBAR_REFLOW_DURATION, easing: STANDARD_EASING },
					),
				);
			}
		}

		const nextGifts = captureGifts(root);
		for (const element of root.querySelectorAll<HTMLElement>('[data-gift-item]')) {
			const id = element.dataset.giftId;
			const previousPosition = id === undefined ? undefined : snapshot.gifts.get(id);
			const nextPosition = id === undefined ? undefined : nextGifts.get(id);
			if (previousPosition === undefined || nextPosition === undefined) {
				continue;
			}
			const translateX = previousPosition.left - nextPosition.left;
			const translateY = previousPosition.top - nextPosition.top;
			if (translateX === 0 && translateY === 0) {
				continue;
			}
			track(
				element.animate(
					[
						{ transform: `translate(${translateX}px, ${translateY}px)` },
						{ transform: 'translate(0, 0)' },
					],
					{ duration: GIFT_REFLOW_DURATION, easing: STANDARD_EASING },
				),
			);
		}
	}

	function destroy() {
		cancel();
	}

	return { capture, play, cancel, destroy };
}
