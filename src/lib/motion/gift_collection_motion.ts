import { GIFT_MOTION_EASING, giftMotionDuration } from './gift_motion_timing.js';
import { LAYOUT_GIFT_MOTION_LIMIT } from './layout_motion.js';
import { copyComputedCustomProperties } from '$lib/components/blocks/wishlist/copy_computed_custom_properties.js';
import { detachedSubgridRows } from '$lib/components/blocks/wishlist/gift_pointer_reorder.svelte.js';

interface Rectangle {
	left: number;
	top: number;
	width: number;
	height: number;
}

interface GiftPosition {
	element: HTMLElement;
	rectangle: Rectangle;
	clone: HTMLElement | null;
	scrollAncestors: readonly HTMLElement[];
}

interface Snapshot {
	gifts: Map<string, GiftPosition>;
	toolbarHeight: number | null;
}

function intersectsViewport(rectangle: Rectangle, viewport: Window | null): boolean {
	return (
		viewport !== null &&
		rectangle.width > 0 &&
		rectangle.height > 0 &&
		rectangle.left + rectangle.width > 0 &&
		rectangle.top + rectangle.height > 0 &&
		rectangle.left < viewport.innerWidth &&
		rectangle.top < viewport.innerHeight
	);
}

function clippedByAncestor(
	rectangle: Rectangle,
	bounds: DOMRect,
	clipsX: boolean,
	clipsY: boolean,
): boolean {
	return (
		(clipsX &&
			(rectangle.left + rectangle.width <= bounds.left || rectangle.left >= bounds.right)) ||
		(clipsY &&
			(rectangle.top + rectangle.height <= bounds.top || rectangle.top >= bounds.bottom))
	);
}

function visible(
	element: HTMLElement,
	rectangle: Rectangle,
	clipCache: Map<HTMLElement, { bounds: DOMRect; clipsX: boolean; clipsY: boolean } | null>,
): boolean {
	if (!element.isConnected || !intersectsViewport(rectangle, element.ownerDocument.defaultView)) {
		return false;
	}
	const style = getComputedStyle(element);
	if (style.display === 'none' || style.visibility === 'hidden') {
		return false;
	}
	for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
		let clip = clipCache.get(ancestor);
		if (clip === undefined) {
			const overflow = getComputedStyle(ancestor);
			const clipsX = /auto|scroll|hidden|clip/.test(overflow.overflowX);
			const clipsY = /auto|scroll|hidden|clip/.test(overflow.overflowY);
			clip =
				clipsX || clipsY
					? { bounds: ancestor.getBoundingClientRect(), clipsX, clipsY }
					: null;
			clipCache.set(ancestor, clip);
		}
		if (!clip) {
			continue;
		}
		if (clippedByAncestor(rectangle, clip.bounds, clip.clipsX, clip.clipsY)) {
			return false;
		}
	}
	return true;
}

function cloneGift(element: HTMLElement): HTMLElement {
	const clone = element.cloneNode(true) as HTMLElement;
	for (const node of [clone, ...clone.querySelectorAll<HTMLElement>('*')]) {
		node.removeAttribute('id');
		node.removeAttribute('tabindex');
	}
	clone.removeAttribute('data-gift-item');
	clone.removeAttribute('data-gift-id');
	clone.setAttribute('aria-hidden', 'true');
	clone.setAttribute('inert', '');
	clone.style.pointerEvents = 'none';
	copyComputedCustomProperties(element, clone);
	const resolvedRows = detachedSubgridRows(element);
	if (resolvedRows !== null) {
		clone.style.gridTemplateRows = resolvedRows;
	}
	if (element.tagName === 'TR') {
		clone.style.display = 'grid';
		clone.style.gridTemplateColumns = [...element.children]
			.map((cell) => `${cell.getBoundingClientRect().width}px`)
			.join(' ');
	}
	return clone;
}

function midpointIndex(elements: HTMLElement[], view: Window): number {
	let lower = 0;
	let upper = elements.length - 1;
	while (lower < upper) {
		const middle = Math.floor((lower + upper) / 2);
		if (elements[middle]!.getBoundingClientRect().bottom < view.innerHeight / 2) {
			lower = middle + 1;
		} else {
			upper = middle;
		}
	}
	return lower;
}

function sampledGiftIndices(host: HTMLElement, elements: HTMLElement[], view: Window): number[] {
	const indices: number[] = [];
	for (const y of [1 / 6, 1 / 2, 5 / 6]) {
		for (const x of [1 / 6, 1 / 2, 5 / 6]) {
			for (const node of host.ownerDocument.elementsFromPoint(
				view.innerWidth * x,
				view.innerHeight * y,
			)) {
				const candidate = node.closest<HTMLElement>('[data-gift-item]');
				const index = candidate === null ? -1 : elements.indexOf(candidate);
				if (index >= 0) {
					indices.push(index);
					break;
				}
			}
		}
	}
	return indices.sort((left, right) => left - right);
}

function candidates(host: HTMLElement): HTMLElement[] {
	const elements = [...host.querySelectorAll<HTMLElement>('[data-gift-item][data-gift-id]')];
	const view = host.ownerDocument.defaultView;
	if (!view || elements.length <= LAYOUT_GIFT_MOTION_LIMIT) {
		return elements;
	}
	// Sample the viewport rather than measuring every item in an unpaginated wishlist.
	const indices = sampledGiftIndices(host, elements, view);
	const index = indices[Math.floor(indices.length / 2)] ?? midpointIndex(elements, view);
	const start = Math.min(
		Math.max(0, index - Math.floor(LAYOUT_GIFT_MOTION_LIMIT / 2)),
		elements.length - LAYOUT_GIFT_MOTION_LIMIT,
	);
	return elements.slice(start, start + LAYOUT_GIFT_MOTION_LIMIT);
}

function toolbar(host: HTMLElement): HTMLElement | null {
	for (let ancestor = host.parentElement; ancestor; ancestor = ancestor.parentElement) {
		const toolbar = ancestor.querySelector<HTMLElement>('[data-testid="wishlist-toolbar"]');
		if (toolbar !== null) {
			return toolbar;
		}
	}
	return null;
}

/** Owns visible gift identity motion in a stable collection host, independent of section DOM keys. */
export function createGiftCollectionMotion(
	host: HTMLElement,
	reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
) {
	let baseline: Snapshot | null = null;
	let pending: Snapshot | null = null;
	let generation = 0;
	let scheduled = 0;
	let destroyed = false;
	let suspended = false;
	const animations = new Set<Animation>();
	const overlays = new Map<HTMLElement, GiftPosition>();
	const scrollPositions = new Map<HTMLElement, { left: number; top: number }>();
	const overrides = new Map<string, Rectangle | null>();
	const movingElements = new Map<HTMLElement, Animation>();
	let toolbarAnimation: Animation | null = null;
	const observed = new Set<HTMLElement>();
	const resizeObserver = new ResizeObserver(() => schedule());
	const mutationObserver = new MutationObserver((records) => {
		if (
			records.some(
				(record) =>
					record.type === 'childList' ||
					(record.type === 'attributes' &&
						!['style', 'data-gift-motion-dragging'].includes(
							record.attributeName ?? '',
						)),
			)
		) {
			schedule();
		}
	});

	function layoutRectangle(element: HTMLElement, rendered: DOMRect): Rectangle {
		if (!movingElements.has(element)) {
			return {
				left: rendered.left,
				top: rendered.top,
				width: rendered.width,
				height: rendered.height,
			};
		}
		const style = getComputedStyle(element);
		const matrix = new DOMMatrixReadOnly(
			style.transform === 'none' ? undefined : style.transform,
		);
		const scaleX = Math.hypot(matrix.a, matrix.b);
		const scaleY = Math.hypot(matrix.c, matrix.d);
		if (scaleX <= 0 || scaleY <= 0) {
			return {
				left: rendered.left,
				top: rendered.top,
				width: rendered.width,
				height: rendered.height,
			};
		}
		const [originX, originY] = style.transformOrigin.split(' ').map(Number.parseFloat);
		return {
			left: rendered.left - matrix.e - (1 - scaleX) * (originX ?? 0),
			top: rendered.top - matrix.f - (1 - scaleY) * (originY ?? 0),
			width: rendered.width / scaleX,
			height: rendered.height / scaleY,
		};
	}

	function captureScrollAncestors(element: HTMLElement): HTMLElement[] {
		const ancestors: HTMLElement[] = [];
		for (
			let ancestor = element.parentElement;
			ancestor !== null;
			ancestor = ancestor.parentElement
		) {
			ancestors.push(ancestor);
			if (!scrollPositions.has(ancestor)) {
				scrollPositions.set(ancestor, {
					left: ancestor.scrollLeft,
					top: ancestor.scrollTop,
				});
			}
		}
		return ancestors;
	}

	function captureGifts(withClones: boolean, endpoints: boolean): Map<string, GiftPosition> {
		const gifts = new Map<string, GiftPosition>();
		const clipCache = new Map<
			HTMLElement,
			{ bounds: DOMRect; clipsX: boolean; clipsY: boolean } | null
		>();
		for (const element of candidates(host)) {
			const id = element.dataset.giftId;
			if (
				id === undefined ||
				id === '' ||
				element.hasAttribute('data-gift-motion-dragging')
			) {
				continue;
			}
			const rendered = element.getBoundingClientRect();
			const rectangle = endpoints ? layoutRectangle(element, rendered) : rendered;
			if (!visible(element, rectangle, clipCache)) {
				continue;
			}
			gifts.set(id, {
				element,
				rectangle: {
					left: rectangle.left,
					top: rectangle.top,
					width: rectangle.width,
					height: rectangle.height,
				},
				clone: withClones ? cloneGift(element) : null,
				scrollAncestors: captureScrollAncestors(element),
			});
		}
		return gifts;
	}

	function measure(withClones = false, endpoints = false): Snapshot {
		const bar = toolbar(host);
		const revealToolbarLayout = endpoints && toolbarAnimation !== null && bar !== null;
		const previousHeight = revealToolbarLayout ? bar.style.getPropertyValue('height') : '';
		const previousPriority = revealToolbarLayout ? bar.style.getPropertyPriority('height') : '';
		if (revealToolbarLayout) {
			bar.style.setProperty('height', 'auto', 'important');
		}
		try {
			return {
				gifts: captureGifts(withClones, endpoints),
				toolbarHeight:
					bar?.isConnected === true ? bar.getBoundingClientRect().height : null,
			};
		} finally {
			if (revealToolbarLayout) {
				if (previousHeight !== '') {
					bar.style.setProperty('height', previousHeight, previousPriority);
				} else {
					bar.style.removeProperty('height');
				}
			}
		}
	}

	function cancel() {
		generation++;
		for (const animation of animations) {
			animation.cancel();
		}
		animations.clear();
		movingElements.clear();
		toolbarAnimation = null;
		for (const overlay of overlays.keys()) {
			overlay.remove();
		}
		overlays.clear();
	}

	function animate(
		element: HTMLElement,
		frames: Keyframe[],
		duration: number,
		overlay?: HTMLElement,
	) {
		const animation = element.animate(frames, { duration, easing: GIFT_MOTION_EASING });
		animations.add(animation);
		const currentGeneration = generation;
		const cleanup = () => {
			animations.delete(animation);
			if (movingElements.get(element) === animation) {
				movingElements.delete(element);
			}
			if (toolbarAnimation === animation) {
				toolbarAnimation = null;
			}
			if (currentGeneration === generation && overlay) {
				overlays.delete(overlay);
				overlay.remove();
			}
		};
		animation.addEventListener('finish', cleanup, { once: true });
		animation.addEventListener('cancel', cleanup, { once: true });
		return animation;
	}

	function overlay(position: GiftPosition): HTMLElement {
		const clone = position.clone ?? cloneGift(position.element);
		const { left, top, width, height } = position.rectangle;
		Object.assign(clone.style, {
			position: 'fixed',
			left: `${left}px`,
			top: `${top}px`,
			width: `${width}px`,
			height: `${height}px`,
			margin: '0',
			zIndex: '100',
			pointerEvents: 'none',
		});
		host.ownerDocument.body.append(clone);
		overlays.set(clone, position);
		return clone;
	}

	function animateToolbar(previous: Snapshot, next: Snapshot) {
		const bar = toolbar(host);
		if (
			bar !== null &&
			previous.toolbarHeight !== null &&
			next.toolbarHeight !== null &&
			previous.toolbarHeight !== next.toolbarHeight &&
			next.toolbarHeight > 0
		) {
			toolbarAnimation = animate(
				bar,
				[
					{ height: `${previous.toolbarHeight}px`, overflow: 'clip' },
					{ height: `${next.toolbarHeight}px`, overflow: 'clip' },
				],
				giftMotionDuration(Math.abs(next.toolbarHeight - previous.toolbarHeight)),
			);
		}
	}

	function animateArrivals(previous: Snapshot, next: Snapshot) {
		for (const [id, destination] of next.gifts) {
			const sourceRectangle = overrides.has(id)
				? overrides.get(id)
				: previous.gifts.get(id)?.rectangle;
			const start =
				sourceRectangle !== undefined &&
				sourceRectangle !== null &&
				intersectsViewport(sourceRectangle, host.ownerDocument.defaultView)
					? sourceRectangle
					: null;
			if (!start) {
				movingElements.set(
					destination.element,
					animate(
						destination.element,
						[
							{ opacity: 0, transform: 'scale(0.98)' },
							{ opacity: 1, transform: 'scale(1)' },
						],
						giftMotionDuration(0),
					),
				);
				continue;
			}
			const initialLayout =
				toolbarAnimation === null
					? destination.rectangle
					: destination.element.getBoundingClientRect();
			const deltaX = start.left - initialLayout.left;
			const deltaY = start.top - initialLayout.top;
			if (deltaX === 0 && deltaY === 0) {
				continue;
			}
			const duration = giftMotionDuration(
				Math.hypot(
					start.left - destination.rectangle.left,
					start.top - destination.rectangle.top,
				),
			);
			movingElements.set(
				destination.element,
				animate(
					destination.element,
					[
						{
							transform: `translate(${deltaX}px, ${deltaY}px)`,
							opacity: 1,
						},
						{ transform: 'translate(0, 0)', opacity: 1 },
					],
					duration,
				),
			);
		}
	}

	function animateDepartures(previous: Snapshot, next: Snapshot) {
		for (const [id, source] of previous.gifts) {
			if (
				next.gifts.has(id) ||
				overrides.has(id) ||
				source.element.hasAttribute('data-gift-motion-dragging') ||
				!intersectsViewport(source.rectangle, host.ownerDocument.defaultView)
			) {
				continue;
			}
			const retained = overlay(source);
			animate(
				retained,
				[
					{ opacity: 1, transform: 'scale(1)' },
					{ opacity: 0, transform: 'scale(0.98)' },
				],
				giftMotionDuration(0),
				retained,
			);
		}
	}

	function play(previous: Snapshot, next: Snapshot) {
		if (reducedMotion() || suspended) {
			return;
		}
		animateToolbar(previous, next);
		animateArrivals(previous, next);
		animateDepartures(previous, next);
	}

	function observe() {
		const currentCandidates = new Set(candidates(host));
		for (const element of currentCandidates) {
			if (!observed.has(element)) {
				resizeObserver.observe(element);
				observed.add(element);
			}
		}
		for (const ancestor of scrollPositions.keys()) {
			if (!ancestor.isConnected) {
				scrollPositions.delete(ancestor);
			}
		}
		for (const element of observed) {
			if (!currentCandidates.has(element)) {
				resizeObserver.unobserve(element);
				observed.delete(element);
			}
		}
	}

	function sameEndpoints(first: Snapshot, second: Snapshot): boolean {
		if (
			first.gifts.size !== second.gifts.size ||
			first.toolbarHeight !== second.toolbarHeight
		) {
			return false;
		}
		for (const [id, initial] of first.gifts) {
			const current = second.gifts.get(id);
			if (!current || initial.element !== current.element) {
				return false;
			}
			for (const field of ['left', 'top', 'width', 'height'] as const) {
				if (Math.abs(initial.rectangle[field] - current.rectangle[field]) > 0.02) {
					return false;
				}
			}
		}
		return true;
	}

	function renderedBaseline(): Snapshot | null {
		if (baseline === null) {
			return null;
		}
		const gifts = new Map(baseline.gifts);
		for (const [id, source] of gifts) {
			if (!source.element.isConnected || !movingElements.has(source.element)) {
				continue;
			}
			const rendered = source.element.getBoundingClientRect();
			const layout = layoutRectangle(source.element, rendered);
			gifts.set(id, {
				...source,
				rectangle: {
					left: source.rectangle.left + rendered.left - layout.left,
					top: source.rectangle.top + rendered.top - layout.top,
					width: (source.rectangle.width * rendered.width) / layout.width,
					height: (source.rectangle.height * rendered.height) / layout.height,
				},
			});
		}
		const bar = toolbar(host);
		return {
			gifts,
			toolbarHeight:
				toolbarAnimation !== null && bar !== null
					? bar.getBoundingClientRect().height
					: baseline.toolbarHeight,
		};
	}

	function settle(previous: Snapshot | null) {
		if (destroyed) {
			return;
		}
		const endpoint = measure(true, true);
		observe();
		if (baseline !== null && sameEndpoints(baseline, endpoint) && overrides.size === 0) {
			baseline = endpoint;
			return;
		}
		if (baseline === null || previous === null) {
			baseline = endpoint;
			overrides.clear();
			return;
		}
		const source = pending ?? renderedBaseline() ?? previous;
		cancel();
		const destination = measure(true, true);
		if (!suspended) {
			play(source, destination);
		}
		baseline = destination;
		overrides.clear();
	}

	function schedule() {
		if (destroyed || suspended || scheduled) {
			return;
		}
		scheduled = requestAnimationFrame(() => {
			scheduled = 0;
			// Collection track alignment is also measured in a frame; read after its frame.
			settle(pending ?? baseline);
			pending = null;
		});
	}

	function beforeUpdate() {
		if (destroyed || suspended) {
			return;
		}
		// Descendant effects may already have patched layout; only the cached endpoints are pre-update.
		pending ??= renderedBaseline();
	}

	function afterUpdate() {
		if (baseline === null && pending === null) {
			settle(null);
			return;
		}
		if (pending) {
			schedule();
		}
	}

	function reset(shouldSuspend = false) {
		cancelAnimationFrame(scheduled);
		scheduled = 0;
		cancel();
		pending = null;
		overrides.clear();
		suspended = shouldSuspend;
		baseline = shouldSuspend ? null : measure(true);
		if (!shouldSuspend) {
			observe();
		}
	}

	function onReducedMotionChange() {
		if (reducedMotion()) {
			reset();
		}
	}

	function onDrop(event: Event) {
		const detail = (event as CustomEvent<{ giftId: string; rectangle: Rectangle }>).detail;
		if (detail?.giftId === undefined || detail.giftId === '') {
			return;
		}
		const rectangle = detail.rectangle;
		const viewport = host.ownerDocument.defaultView;
		const isVisible =
			rectangle !== undefined &&
			[rectangle.left, rectangle.top, rectangle.width, rectangle.height].every(
				Number.isFinite,
			) &&
			intersectsViewport(rectangle, viewport);
		overrides.set(detail.giftId, isVisible ? rectangle : null);
		// The source remains hidden until the pointer owner finishes cleanup.
		queueMicrotask(schedule);
	}

	function shiftSnapshot(
		snapshot: Snapshot | null,
		target: HTMLElement,
		deltaX: number,
		deltaY: number,
	) {
		if (snapshot === null) {
			return;
		}
		for (const [id, position] of snapshot.gifts) {
			if (position.scrollAncestors.includes(target)) {
				snapshot.gifts.set(id, {
					...position,
					rectangle: {
						...position.rectangle,
						left: position.rectangle.left - deltaX,
						top: position.rectangle.top - deltaY,
					},
				});
			}
		}
	}

	function onScroll(event: Event) {
		const target =
			event.target === host.ownerDocument
				? host.ownerDocument.scrollingElement
				: event.target;
		if (!(target instanceof HTMLElement)) {
			return;
		}
		const previous = scrollPositions.get(target);
		if (previous === undefined) {
			return;
		}
		const deltaX = target.scrollLeft - previous.left;
		const deltaY = target.scrollTop - previous.top;
		scrollPositions.set(target, { left: target.scrollLeft, top: target.scrollTop });
		shiftSnapshot(baseline, target, deltaX, deltaY);
		shiftSnapshot(pending, target, deltaX, deltaY);
		if (pending === null && !suspended) {
			const previousBaseline = baseline;
			baseline = measure(false, true);
			for (const [id, position] of baseline.gifts) {
				position.clone = previousBaseline?.gifts.get(id)?.clone ?? null;
			}
			observe();
		}
		for (const [visual, position] of overlays) {
			if (position.scrollAncestors.includes(target)) {
				visual.style.left = `${Number.parseFloat(visual.style.left) - deltaX}px`;
				visual.style.top = `${Number.parseFloat(visual.style.top) - deltaY}px`;
			}
		}
	}
	function onScrollEnd() {
		if (pending === null && !suspended && !destroyed) {
			baseline = measure(true, true);
		}
	}

	host.addEventListener('gift-motion-drop', onDrop);
	host.ownerDocument.addEventListener('scroll', onScroll, true);
	host.ownerDocument.addEventListener('scrollend', onScrollEnd, true);
	window.addEventListener('resize', schedule);
	resizeObserver.observe(host);
	mutationObserver.observe(host, {
		subtree: true,
		childList: true,
		characterData: true,
		attributes: true,
		attributeFilter: ['class', 'hidden', 'aria-hidden', 'data-gift-motion-dragging'],
	});
	const motionPreference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
	motionPreference?.addEventListener('change', onReducedMotionChange);
	const fonts = host.ownerDocument.fonts;
	fonts?.addEventListener('loadingdone', schedule);
	void fonts?.ready.then(schedule);

	return {
		beforeUpdate,
		afterUpdate,
		reset,
		destroy() {
			destroyed = true;
			cancelAnimationFrame(scheduled);
			cancel();
			resizeObserver.disconnect();
			mutationObserver.disconnect();
			host.removeEventListener('gift-motion-drop', onDrop);
			host.ownerDocument.removeEventListener('scroll', onScroll, true);
			host.ownerDocument.removeEventListener('scrollend', onScrollEnd, true);
			window.removeEventListener('resize', schedule);
			fonts?.removeEventListener('loadingdone', schedule);
			motionPreference?.removeEventListener('change', onReducedMotionChange);
		},
	};
}
