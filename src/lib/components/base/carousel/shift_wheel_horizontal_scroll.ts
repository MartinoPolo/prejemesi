import type { CarouselAPI, CarouselPlugins } from './context.js';

/** A single embla plugin — the element type of the carousel's `plugins` array. */
export type ShiftWheelHorizontalScrollType = NonNullable<CarouselPlugins>[number];

/**
 * Embla plugin: makes Shift+wheel scroll the carousel horizontally.
 *
 * WHY: Chromium delivers a Shift+wheel gesture as `{ deltaX: 0, deltaY: N,
 * shiftKey: true }` — it does NOT pre-swap the axes the way Firefox/Safari do.
 * `embla-carousel-wheel-gestures` only starts a horizontal gesture when
 * `|deltaX| > |deltaY|`, and its `forceWheelAxis: 'x'` option remaps the axis
 * embla scrolls along, not the incoming wheel deltas, so a Chromium Shift+wheel
 * never reaches the carousel. This plugin bridges the gap: on the carousel
 * viewport it intercepts a Shift+vertical wheel, cancels it, and re-dispatches a
 * synthetic wheel whose `deltaY` is moved onto `deltaX`. That synthetic
 * horizontal event is picked up by the existing WheelGesturesPlugin and drives
 * the carousel.
 *
 * The `deltaX === 0` guard means the synthetic event (which carries only
 * `deltaX`) never re-triggers the handler, and on browsers that already deliver
 * Shift+wheel as `deltaX` the handler is a no-op — those events pass straight
 * through to the wheel-gestures plugin.
 */
export function ShiftWheelHorizontalScroll(): ShiftWheelHorizontalScrollType {
	let viewport: HTMLElement | null = null;

	function onWheel(event: WheelEvent) {
		if (!(event.shiftKey && event.deltaX === 0 && event.deltaY !== 0)) {
			return;
		}
		event.preventDefault();
		event.stopImmediatePropagation();
		viewport?.dispatchEvent(
			new WheelEvent('wheel', {
				deltaX: event.deltaY,
				deltaY: 0,
				clientX: event.clientX,
				clientY: event.clientY,
				bubbles: true,
				cancelable: true,
			}),
		);
	}

	const self: ShiftWheelHorizontalScrollType = {
		name: 'shiftWheelHorizontalScroll',
		options: {},
		init(emblaApi: CarouselAPI) {
			viewport = emblaApi.containerNode().parentElement;
			viewport?.addEventListener('wheel', onWheel, { capture: true, passive: false });
		},
		destroy() {
			viewport?.removeEventListener('wheel', onWheel, { capture: true });
			viewport = null;
		},
	};

	return self;
}
