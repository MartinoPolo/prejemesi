import { afterEach, describe, expect, it, vi } from 'vitest';
import { REVEAL_HELD_ATTRIBUTE, revealOnView } from './reveal_on_view.js';

const cleanups: Array<() => void> = [];

function attachedElement(offsetTop: string): HTMLElement {
	const element = document.createElement('div');
	element.style.marginTop = offsetTop;
	element.style.height = '200px';
	document.body.append(element);
	const cleanup = revealOnView(element);
	cleanups.push(() => {
		cleanup?.();
		element.remove();
	});
	return element;
}

describe('revealOnView', () => {
	afterEach(() => {
		for (const cleanup of cleanups.splice(0)) {
			cleanup();
		}
		vi.restoreAllMocks();
		window.scrollTo(0, 0);
	});

	it('leaves an entrance that is already in view to play on load', () => {
		const element = attachedElement('0px');

		expect(element.hasAttribute(REVEAL_HELD_ATTRIBUTE)).toBe(false);
	});

	it('holds an entrance below the fold until it scrolls into view', async () => {
		const element = attachedElement('300vh');

		expect(element.hasAttribute(REVEAL_HELD_ATTRIBUTE)).toBe(true);

		element.scrollIntoView();
		await expect.poll(() => element.hasAttribute(REVEAL_HELD_ATTRIBUTE)).toBe(false);
	});

	it('never holds content under reduced motion, which has no entrance to wait for', () => {
		vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);

		const element = attachedElement('300vh');

		expect(element.hasAttribute(REVEAL_HELD_ATTRIBUTE)).toBe(false);
	});
});
