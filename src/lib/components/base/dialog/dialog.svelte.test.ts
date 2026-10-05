import { afterEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import DialogTestFixture from './dialog_test_fixture.svelte';

afterEach(async () => page.viewport(1280, 720));

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
