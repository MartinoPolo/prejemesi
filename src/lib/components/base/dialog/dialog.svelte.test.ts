import { afterEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import DialogTestFixture from './dialog_test_fixture.svelte';
import { expectContentClearsOverlayClose } from './overlay_close_geometry.test_fixtures.js';

afterEach(async () => {
	delete document.documentElement.dataset.depth;
	await page.viewport(1280, 720);
});

function titleLinesCollidingWithCloseButton(): number {
	const title = document.querySelector('[data-slot="dialog-title"]');
	const closeButton = document.querySelector('[data-slot="dialog-close"]');
	if (title === null || closeButton === null) {
		throw new Error('Missing dialog title or close button');
	}
	const close = closeButton.getBoundingClientRect();
	const range = document.createRange();
	range.selectNodeContents(title);
	return [...range.getClientRects()].filter(
		(line) =>
			line.right > close.left &&
			line.left < close.right &&
			line.bottom > close.top &&
			line.top < close.bottom,
	).length;
}

describe('Dialog title and close button', () => {
	it.each([
		[390, 'Obnovit toto demo?'],
		[390, 'Create a real account?'],
		[1280, 'Create a real account with a deliberately long dialog heading'],
	])('keeps the title clear of the close button at %ipx: %s', async (viewportWidth, title) => {
		await page.viewport(viewportWidth, 844);
		render(DialogTestFixture, { title });
		await expect.element(page.getByRole('heading', { name: title })).toBeVisible();
		expect(titleLinesCollidingWithCloseButton()).toBe(0);
	});

	it.each([
		['soft', 390],
		['soft', 1280],
		['ink', 390],
		['black', 390],
		['ink', 1280],
	] as const)(
		'reserves the close button and its depth gap beside the title at %s depth and %ipx',
		async (depth, viewportWidth) => {
			document.documentElement.dataset.depth = depth;
			await page.viewport(viewportWidth, 844);
			const titleText = 'Create a real account with a deliberately long dialog heading';
			render(DialogTestFixture, { title: titleText });
			const title = page.getByRole('heading', { name: titleText }).element() as HTMLElement;
			await expect.element(title).toBeVisible();
			await Promise.all(document.getAnimations().map((animation) => animation.finished));

			expectContentClearsOverlayClose(
				title,
				document.querySelector<HTMLElement>('[data-slot="dialog-close"]')!,
			);
		},
	);

	it('does not reserve close-button space when the dialog has no close button', async () => {
		await page.viewport(390, 844);
		render(DialogTestFixture, { title: 'No close button', showCloseButton: false });
		const title = page.getByRole('heading', { name: 'No close button' });
		await expect.element(title).toBeVisible();
		const style = getComputedStyle(title.element());
		expect(style.paddingInlineStart).toBe('0px');
		expect(style.paddingInlineEnd).toBe('0px');
	});
});
