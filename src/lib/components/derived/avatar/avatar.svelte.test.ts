import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import { createPixelAssertions } from '../../../../../tests/helpers/pixel-assertions.mjs';
import Avatar from './Avatar.svelte';

const { expectPixelsNear, expectPixelsAtLeast } = createPixelAssertions(expect);
vi.mock('$env/dynamic/public', () => ({ env: {} }));

const IMAGE =
	'data:image/svg+xml,' +
	encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"/>');

function expectCircularGeometry(element: HTMLElement): void {
	const rect = element.getBoundingClientRect();
	const radius = Number.parseFloat(getComputedStyle(element).borderRadius);
	expectPixelsNear(rect.width, rect.height);
	expectPixelsAtLeast(radius, rect.width / 2);
}

function expectConcentric(outer: HTMLElement, inner: HTMLElement): void {
	const outerRect = outer.getBoundingClientRect();
	const innerRect = inner.getBoundingClientRect();
	expectCircularGeometry(outer);
	expectCircularGeometry(inner);
	const border = Number.parseFloat(getComputedStyle(outer).borderLeftWidth);
	expectPixelsNear(innerRect.width, outerRect.width - 2 * border);
	expectPixelsNear(innerRect.height, outerRect.height - 2 * border);
	expectPixelsNear(innerRect.left + innerRect.width / 2, outerRect.left + outerRect.width / 2);
	expectPixelsNear(innerRect.top + innerRect.height / 2, outerRect.top + outerRect.height / 2);
}

function hasVisibleShadow(element: HTMLElement): boolean {
	const shadow = getComputedStyle(element).boxShadow;
	if (shadow === 'none') {
		return false;
	}
	const alphas = Array.from(shadow.matchAll(/rgba\([^)]*,\s*([\d.]+)\)/g), (match) =>
		Number(match[1]),
	);
	return alphas.length === 0 || alphas.some((alpha) => alpha > 0);
}

describe('Avatar variants', () => {
	it('renders the default initials fallback as a decorative rounded square', async () => {
		const screen = await render(Avatar, { src: null, alt: '', initials: 'AB' });
		const root = screen.container.querySelector('[data-slot="avatar"]') as HTMLElement;
		const fallback = root.firstElementChild as HTMLElement;
		const rootRect = root.getBoundingClientRect();

		expectPixelsNear(rootRect.width, 32);
		expectPixelsNear(rootRect.height, 32);
		expect(getComputedStyle(root).borderRadius).not.toBe('50%');
		expect(fallback).toHaveAttribute('aria-hidden', 'true');
		expect(fallback).toHaveTextContent('AB');
		await screen.unmount();
	});

	it.each([
		{ src: IMAGE, child: 'img' },
		{ src: null, child: 'span' },
	])('keeps a bordered circle concentric for the $child path', async ({ src, child }) => {
		const screen = await render(Avatar, {
			src,
			alt: src === null ? '' : 'Avatar',
			initials: 'AB',
			size: 'xs',
			shape: 'circle',
			bordered: true,
		});
		const root = screen.container.querySelector('[data-slot="avatar"]') as HTMLElement;
		const renderedChild = root.querySelector(child) as HTMLElement;

		const rootStyle = getComputedStyle(root);
		const rootRect = root.getBoundingClientRect();
		expectPixelsNear(rootRect.width, 24);
		expectPixelsNear(rootRect.height, 24);
		expect(Number.parseFloat(rootStyle.borderTopWidth)).toBeGreaterThan(0);
		expectConcentric(root, renderedChild);
		await screen.unmount();
	});

	it.each([
		{ src: IMAGE, child: 'img' },
		{ src: null, child: 'span' },
	])(
		'renders the recipient appearance without sticker shadow for $child',
		async ({ src, child }) => {
			const screen = await render(Avatar, {
				src,
				alt: src === null ? '' : 'Avatar',
				initials: 'AB',
				appearance: 'recipient',
			});
			const root = screen.container.querySelector('[data-slot="avatar"]') as HTMLElement;
			const renderedChild = root.querySelector(child) as HTMLElement;
			const rootStyle = getComputedStyle(root);

			expectPixelsNear(root.getBoundingClientRect().width, 24);
			expect(rootStyle.borderTopWidth).toBe('2px');
			expectPixelsAtLeast(Number.parseFloat(rootStyle.borderRadius), 12);
			expect(hasVisibleShadow(root)).toBe(false);
			expect(getComputedStyle(renderedChild).borderRadius).toBe('10px');
			if (src === null) {
				expect(getComputedStyle(renderedChild).fontSize).toBe('10px');
				expect(getComputedStyle(renderedChild).fontWeight).toBe('800');
			}
			await screen.unmount();
		},
	);
});
