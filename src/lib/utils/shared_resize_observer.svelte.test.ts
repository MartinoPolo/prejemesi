import { describe, expect, it, vi } from 'vitest';
import { observeResize } from './shared_resize_observer.js';

describe('observeResize', () => {
	it('reports the initial size to a listener joining an already observed element', async () => {
		const element = document.createElement('div');
		element.style.cssText = 'width: 40px; height: 20px';
		document.body.append(element);
		const firstListener = vi.fn();
		const laterListener = vi.fn();
		const stopFirst = observeResize(element, firstListener);
		try {
			await expect.poll(() => firstListener.mock.calls.length).toBeGreaterThan(0);
			const stopLater = observeResize(element, laterListener);

			await expect.poll(() => laterListener.mock.calls.length).toBeGreaterThan(0);
			stopLater();
		} finally {
			stopFirst();
			element.remove();
		}
	});

	it('runs the writes listeners return only after every listener has read', async () => {
		const elements = [document.createElement('div'), document.createElement('div')];
		const calls: string[] = [];
		const stops = elements.map((element, index) => {
			element.style.cssText = 'width: 40px; height: 20px';
			document.body.append(element);
			return observeResize(element, () => {
				calls.push(`read ${String(index)}`);
				return () => calls.push(`write ${String(index)}`);
			});
		});
		try {
			await expect.poll(() => calls.length).toBe(4);
			expect(calls).toEqual(['read 0', 'read 1', 'write 0', 'write 1']);
		} finally {
			stops.forEach((stop) => stop());
			elements.forEach((element) => element.remove());
		}
	});
});
