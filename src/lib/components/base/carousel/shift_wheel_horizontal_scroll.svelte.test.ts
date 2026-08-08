import { describe, it, expect } from 'vitest';
import type { CarouselAPI } from './context.js';
import { ShiftWheelHorizontalScroll } from './shift_wheel_horizontal_scroll.js';

/**
 * Runs in the vitest browser (chromium) project via the `.svelte.test.ts` glob,
 * so `WheelEvent`, `dispatchEvent`, and `defaultPrevented` behave like the real
 * DOM the plugin ships against.
 */
function setup() {
	const viewport = document.createElement('div');
	const container = document.createElement('div');
	viewport.appendChild(container);
	document.body.appendChild(viewport);

	const fakeApi = { containerNode: () => container } as unknown as CarouselAPI;
	const plugin = ShiftWheelHorizontalScroll();
	plugin.init(fakeApi, undefined as never);

	return {
		viewport,
		cleanup() {
			plugin.destroy();
			viewport.remove();
		},
	};
}

describe('ShiftWheelHorizontalScroll plugin', () => {
	it('remaps a Chromium Shift+vertical wheel into a horizontal deltaX event', () => {
		const { viewport, cleanup } = setup();
		const received: WheelEvent[] = [];
		viewport.addEventListener('wheel', (event) => received.push(event as WheelEvent));

		const original = new WheelEvent('wheel', {
			deltaX: 0,
			deltaY: 120,
			shiftKey: true,
			bubbles: true,
			cancelable: true,
		});
		viewport.dispatchEvent(original);

		expect(original.defaultPrevented).toBe(true);
		const remapped = received.find((event) => event.deltaX !== 0);
		expect(remapped).toBeDefined();
		expect(remapped?.deltaX).toBe(120);
		expect(remapped?.deltaY).toBe(0);

		cleanup();
	});

	it('leaves a plain vertical wheel event untouched so the page keeps scrolling', () => {
		const { viewport, cleanup } = setup();
		const received: WheelEvent[] = [];
		viewport.addEventListener('wheel', (event) => received.push(event as WheelEvent));

		const original = new WheelEvent('wheel', {
			deltaX: 0,
			deltaY: 120,
			shiftKey: false,
			bubbles: true,
			cancelable: true,
		});
		viewport.dispatchEvent(original);

		expect(original.defaultPrevented).toBe(false);
		expect(received).toEqual([original]);

		cleanup();
	});
});
