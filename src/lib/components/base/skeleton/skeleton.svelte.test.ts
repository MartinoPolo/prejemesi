import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { Skeleton } from './index.js';

function skeletonElement(container: HTMLElement): HTMLElement {
	const element = container.querySelector<HTMLElement>('[data-slot="skeleton"]');
	if (element === null) {
		throw new Error('Skeleton did not render');
	}
	return element;
}

describe('Skeleton', () => {
	afterEach(() => {
		window.scrollTo(0, 0);
	});

	it('pulses while visible', async () => {
		const { container } = render(Skeleton, { class: 'h-4 w-48' });
		const skeleton = skeletonElement(container);

		await expect.poll(() => getComputedStyle(skeleton).animationName).toBe('pulse');
		await expect.poll(() => getComputedStyle(skeleton).animationPlayState).toBe('running');
		expect(skeleton.hasAttribute('data-offscreen')).toBe(false);
	});

	it('pauses its pulse while scrolled out of view and resumes when scrolled back', async () => {
		const { container } = render(Skeleton, { class: 'h-4 w-48', style: 'margin-top: 300vh' });
		const skeleton = skeletonElement(container);

		await expect.poll(() => getComputedStyle(skeleton).animationPlayState).toBe('paused');

		skeleton.scrollIntoView();
		await expect.poll(() => getComputedStyle(skeleton).animationPlayState).toBe('running');
	});
});
