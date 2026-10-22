import type { CarouselAPI, CarouselPlugins } from './context.js';

export type WheelHorizontalScrollType = NonNullable<CarouselPlugins>[number];

const PIXELS_PER_LINE = 40;
// Just past critical damping for embla's scroll body: each notch glides in within ~250 ms, like
// native smooth wheel scrolling, and never springs past its target (or the row's edge).
const WHEEL_GLIDE_FRICTION = 0.5;
const WHEEL_GLIDE_DURATION = 6;

/**
 * Embla plugin: Shift+wheel and horizontal trackpad deltas scroll the carousel like a native
 * scroller — each delta moves the target by the same distance, clamped to the row's bounds, and
 * the scroll body glides there. Plain vertical wheel is left alone so the page keeps scrolling.
 *
 * WHY not drag emulation (embla-carousel-wheel-gestures): replaying discrete wheel notches as a
 * synthetic pointer drag turns every notch into an instant pointer jump, keeps the "pointer"
 * down until a timeout guesses the gesture ended (so edge rubber-banding stays visibly
 * overshot), and then releases with a fling. Touch dragging is untouched by this plugin.
 */
export function WheelHorizontalScroll(): WheelHorizontalScrollType {
	let api: CarouselAPI | undefined;
	let viewport: HTMLElement | null = null;

	function horizontalDelta(event: WheelEvent): number {
		// Chromium reports Shift+wheel as a vertical delta; Firefox and Safari already swap it onto deltaX.
		const isChromiumShiftWheel = event.shiftKey && event.deltaX === 0;
		const isHorizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
		const delta = isChromiumShiftWheel ? event.deltaY : isHorizontal ? event.deltaX : 0;
		if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
			return delta * PIXELS_PER_LINE;
		}
		if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
			return delta * (viewport?.clientWidth ?? 0);
		}
		return delta;
	}

	function onWheel(event: WheelEvent) {
		const delta = horizontalDelta(event);
		if (!api || delta === 0) {
			return;
		}
		// Claim every horizontal wheel over the row, even at an edge, so it never triggers history swipes.
		event.preventDefault();
		const engine = api.internalEngine();
		if (engine.dragHandler.pointerDown()) {
			return;
		}
		const currentTarget = engine.target.get();
		const nextTarget = engine.limit.constrain(currentTarget + engine.axis.direction(-delta));
		if (nextTarget === currentTarget) {
			return;
		}
		engine.scrollBody.useFriction(WHEEL_GLIDE_FRICTION).useDuration(WHEEL_GLIDE_DURATION);
		engine.scrollTo.distance(nextTarget - currentTarget, false);
	}

	const self: WheelHorizontalScrollType = {
		name: 'wheelHorizontalScroll',
		options: {},
		init(emblaApi: CarouselAPI) {
			api = emblaApi;
			viewport = emblaApi.containerNode().parentElement;
			viewport?.addEventListener('wheel', onWheel, { passive: false });
		},
		destroy() {
			viewport?.removeEventListener('wheel', onWheel);
			viewport = null;
			api = undefined;
		},
	};

	return self;
}
