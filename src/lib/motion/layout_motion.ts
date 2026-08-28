const STANDARD_EASING = 'cubic-bezier(0.2, 0.7, 0.3, 1)';
const GIFT_REFLOW_DURATION = 520;
const TOOLBAR_REFLOW_DURATION = 320;

/**
 * Maximum gift rows measured and FLIP-animated in one layout run. Long, unpaginated
 * lists settle immediately outside this candidate window instead of doing unbounded
 * synchronous layout reads and animations.
 */
export const LAYOUT_GIFT_MOTION_LIMIT = 48;

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

interface LayoutMotionPlayOptions {
	excludeGiftIds?: ReadonlySet<string>;
}

function isVisibleRectangle(element: HTMLElement, rectangle: DOMRect): boolean {
	if (!element.isConnected || element.hidden || rectangle.width <= 0 || rectangle.height <= 0) {
		return false;
	}
	const style = getComputedStyle(element);
	return style.display !== 'none' && style.visibility !== 'hidden';
}

interface GiftCapture {
	positions: Map<string, Position>;
	elements: Map<string, HTMLElement>;
}

function viewportGiftIndex(root: ParentNode, all: readonly HTMLElement[]): number | null {
	const document = root instanceof Document ? root : root.ownerDocument;
	const viewport = document?.defaultView;
	if (
		document === null ||
		document === undefined ||
		viewport === null ||
		viewport === undefined ||
		typeof document.elementsFromPoint !== 'function'
	) {
		return null;
	}

	const indices = new Set<number>();
	const sampleFractions = [1 / 6, 1 / 2, 5 / 6];
	for (const yFraction of sampleFractions) {
		for (const xFraction of sampleFractions) {
			const stack = document.elementsFromPoint(
				viewport.innerWidth * xFraction,
				viewport.innerHeight * yFraction,
			);
			for (const node of stack) {
				const gift = node.closest<HTMLElement>('[data-gift-item]');
				const index = gift === null ? -1 : all.indexOf(gift);
				if (index >= 0) {
					indices.add(index);
					break;
				}
			}
		}
	}

	const ordered = [...indices].sort((left, right) => left - right);
	return ordered.length === 0 ? null : ordered[Math.floor(ordered.length / 2)];
}

function giftCandidates(root: ParentNode): HTMLElement[] {
	const all = [...root.querySelectorAll<HTMLElement>('[data-gift-item]')];
	if (all.length <= LAYOUT_GIFT_MOTION_LIMIT) {
		return all;
	}

	const visibleIndex = viewportGiftIndex(root, all) ?? 0;
	const start = Math.min(
		Math.max(0, visibleIndex - Math.floor(LAYOUT_GIFT_MOTION_LIMIT / 2)),
		all.length - LAYOUT_GIFT_MOTION_LIMIT,
	);
	return all.slice(start, start + LAYOUT_GIFT_MOTION_LIMIT);
}

function captureGifts(root: ParentNode): GiftCapture {
	const positions = new Map<string, Position>();
	const elements = new Map<string, HTMLElement>();
	for (const element of giftCandidates(root)) {
		const id = element.dataset.giftId;
		if (id === undefined || id === '') {
			continue;
		}
		const rectangle = element.getBoundingClientRect();
		if (isVisibleRectangle(element, rectangle)) {
			positions.set(id, { left: rectangle.left, top: rectangle.top });
			elements.set(id, element);
		}
	}
	return { positions, elements };
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
			gifts: captureGifts(root).positions,
			toolbarHeight:
				toolbar?.isConnected === true ? toolbar.getBoundingClientRect().height : null,
		};
	}

	async function play(
		snapshot: LayoutMotionSnapshot,
		root: ParentNode,
		toolbar?: HTMLElement | null,
		options: LayoutMotionPlayOptions = {},
	) {
		if (snapshot.run !== run || reducedMotion()) {
			return;
		}
		const settlements: Promise<unknown>[] = [];
		const animate = (
			element: HTMLElement,
			keyframes: Keyframe[],
			timing: KeyframeAnimationOptions,
		) => {
			const animation = element.animate(keyframes, timing);
			track(animation);
			if (animation.finished !== undefined) {
				settlements.push(animation.finished.catch(() => undefined));
			}
		};

		if (toolbar?.isConnected === true && snapshot.toolbarHeight !== null) {
			const nextHeight = toolbar.getBoundingClientRect().height;
			if (nextHeight > 0 && nextHeight !== snapshot.toolbarHeight) {
				animate(
					toolbar,
					[
						{ height: `${snapshot.toolbarHeight}px`, overflow: 'clip' },
						{ height: `${nextHeight}px`, overflow: 'clip' },
					],
					{ duration: TOOLBAR_REFLOW_DURATION, easing: STANDARD_EASING },
				);
			}
		}

		const nextGifts = captureGifts(root);
		for (const [id, element] of nextGifts.elements) {
			const previousPosition = snapshot.gifts.get(id);
			const nextPosition = nextGifts.positions.get(id);
			if (
				options.excludeGiftIds?.has(id) === true ||
				previousPosition === undefined ||
				nextPosition === undefined
			) {
				continue;
			}
			const translateX = previousPosition.left - nextPosition.left;
			const translateY = previousPosition.top - nextPosition.top;
			if (translateX === 0 && translateY === 0) {
				continue;
			}
			animate(
				element,
				[
					{ transform: `translate(${translateX}px, ${translateY}px)` },
					{ transform: 'translate(0, 0)' },
				],
				{ duration: GIFT_REFLOW_DURATION, easing: STANDARD_EASING },
			);
		}
		await Promise.all(settlements);
	}

	function destroy() {
		cancel();
	}

	return { capture, play, cancel, destroy };
}
