import type { Attachment } from 'svelte/attachments';

const SELECTION_ATTRIBUTES = ['data-state', 'aria-checked', 'aria-selected', 'aria-current'];
const INDICATOR_SELECTOR = ':scope > [data-slot="selection-indicator"]';
const GROUP_ATTRIBUTE = 'data-selection-group';
const FACE_ATTRIBUTE = 'data-selection-face';
const PLACED_ATTRIBUTE = 'data-selection-placed';
const ANIMATABLE_ATTRIBUTE = 'data-selection-animatable';

export interface SelectionSlideOptions {
	/** Matches the group's options among its direct children. */
	optionSelector: string;
	/** Matches the currently selected option. */
	selectedSelector: string;
	/** Matches the painted selected face inside an option; the option itself when omitted. */
	faceSelector?: string;
	/** Option the indicator appears on at mount before sliding to the selection. */
	startOptionIndex?: number;
}

interface FaceGeometry {
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * Layout offsets ignore transforms, so dialogs and cards animating their transform on open do not
 * skew the measurement the way bounding rectangles would.
 */
function measureFace(face: HTMLElement, group: HTMLElement): FaceGeometry | null {
	if (face.offsetWidth === 0 || face.offsetHeight === 0) {
		return null;
	}
	let x = 0;
	let y = 0;
	let element: HTMLElement | null = face;
	while (element !== null && element !== group) {
		x += element.offsetLeft;
		y += element.offsetTop;
		const offsetParent: Element | null = element.offsetParent;
		if (!(offsetParent instanceof HTMLElement)) {
			return null;
		}
		if (offsetParent !== group) {
			x += offsetParent.clientLeft;
			y += offsetParent.clientTop;
		}
		element = offsetParent;
	}
	return { x, y, width: face.offsetWidth, height: face.offsetHeight };
}

function isSameGeometry(first: FaceGeometry | null, second: FaceGeometry | null): boolean {
	return (
		first !== null &&
		second !== null &&
		first.x === second.x &&
		first.y === second.y &&
		first.width === second.width &&
		first.height === second.height
	);
}

/**
 * Slides the group's `selection-indicator` child, painted like the selected face, to the selected
 * option. Selection changes animate; mount, resize and font loading reposition instantly. Until the
 * indicator is placed, the options keep painting their own selected face.
 */
export function selectionSlide(options: SelectionSlideOptions): Attachment<HTMLElement> {
	return (group) => {
		const renderedIndicator = group.querySelector<HTMLElement>(INDICATOR_SELECTOR);
		if (renderedIndicator === null) {
			return;
		}
		const indicator: HTMLElement = renderedIndicator;

		let placedGeometry: FaceGeometry | null = null;
		let animationFrame = 0;
		let slidingFromStart = false;
		let destroyed = false;

		function optionElements(): HTMLElement[] {
			return Array.from(group.children).filter(
				(child): child is HTMLElement =>
					child instanceof HTMLElement && child.matches(options.optionSelector),
			);
		}

		function faceOf(option: HTMLElement | undefined): HTMLElement | null {
			if (option === undefined) {
				return null;
			}
			if (options.faceSelector === undefined) {
				return option;
			}
			return option.querySelector<HTMLElement>(options.faceSelector);
		}

		function selectedFace(): HTMLElement | null {
			return faceOf(
				optionElements().find((option) => option.matches(options.selectedSelector)),
			);
		}

		function markFace(face: HTMLElement | null) {
			for (const marked of group.querySelectorAll(`[${FACE_ATTRIBUTE}]`)) {
				if (marked !== face) {
					marked.removeAttribute(FACE_ATTRIBUTE);
				}
			}
			face?.setAttribute(FACE_ATTRIBUTE, '');
		}

		function place(face: HTMLElement | null) {
			// Hide the marked face before measuring forces a style pass; otherwise it first resolves its
			// own painted face, and its decoration transition fades that out as a ghost.
			group.setAttribute(PLACED_ATTRIBUTE, '');
			const geometry = face === null ? null : measureFace(face, group);
			placedGeometry = geometry;
			if (geometry === null) {
				group.removeAttribute(PLACED_ATTRIBUTE);
				return;
			}
			indicator.style.setProperty('--selection-x', `${geometry.x}px`);
			indicator.style.setProperty('--selection-y', `${geometry.y}px`);
			indicator.style.setProperty('--selection-width', `${geometry.width}px`);
			indicator.style.setProperty('--selection-height', `${geometry.height}px`);
		}

		function placeInstantly(face: HTMLElement | null, afterPlacement?: () => void) {
			cancelAnimationFrame(animationFrame);
			slidingFromStart = false;
			group.removeAttribute(ANIMATABLE_ATTRIBUTE);
			place(face);
			// Commit the unanimated position before transitions are re-enabled.
			void getComputedStyle(indicator).translate;
			animationFrame = requestAnimationFrame(() => {
				group.setAttribute(ANIMATABLE_ATTRIBUTE, '');
				afterPlacement?.();
			});
		}

		function slideToSelection() {
			const face = selectedFace();
			markFace(face);
			if (placedGeometry !== null && group.hasAttribute(ANIMATABLE_ATTRIBUTE)) {
				place(face);
			} else {
				placeInstantly(face);
			}
		}

		function settle() {
			// The pending start slide measures the selection itself on the next frame.
			if (destroyed || slidingFromStart) {
				return;
			}
			const face = selectedFace();
			markFace(face);
			if (face !== null && isSameGeometry(measureFace(face, group), placedGeometry)) {
				return;
			}
			placeInstantly(face);
		}

		const resizeObserver = new ResizeObserver(settle);
		function observeSizes() {
			resizeObserver.observe(group);
			for (const option of optionElements()) {
				resizeObserver.observe(option);
				const face = faceOf(option);
				if (face !== null && face !== option) {
					resizeObserver.observe(face);
				}
			}
		}

		const mutationObserver = new MutationObserver((mutations) => {
			if (mutations.some((mutation) => mutation.type === 'childList')) {
				observeSizes();
			}
			slideToSelection();
		});

		group.setAttribute(GROUP_ATTRIBUTE, '');
		const initialFace = selectedFace();
		markFace(initialFace);
		const startFace =
			options.startOptionIndex === undefined
				? null
				: faceOf(optionElements()[options.startOptionIndex]);
		if (startFace !== null && startFace !== initialFace) {
			placeInstantly(startFace, () => {
				slidingFromStart = false;
				slideToSelection();
			});
			slidingFromStart = true;
		} else {
			placeInstantly(initialFace);
		}

		observeSizes();
		mutationObserver.observe(group, {
			subtree: true,
			childList: true,
			attributes: true,
			attributeFilter: SELECTION_ATTRIBUTES,
		});
		void document.fonts.ready.then(settle);

		return () => {
			destroyed = true;
			cancelAnimationFrame(animationFrame);
			resizeObserver.disconnect();
			mutationObserver.disconnect();
			markFace(null);
			for (const attribute of [PLACED_ATTRIBUTE, ANIMATABLE_ATTRIBUTE, GROUP_ATTRIBUTE]) {
				group.removeAttribute(attribute);
			}
		};
	};
}
