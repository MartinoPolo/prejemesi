import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import GiftImageEditEntry from './GiftImageEditEntry.svelte';

const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };

const imageBoxes = new Set<HTMLElement>();

afterEach(() => {
	for (const box of imageBoxes) {
		box.remove();
	}
	imageBoxes.clear();
});

/** Renders the entry over a 4:3 card-sized image box, as the editor preview places it. */
function renderEntry(expandable: boolean) {
	const imageBox = document.createElement('div');
	imageBox.style.cssText = 'position: relative; width: 288px; height: 216px;';
	document.body.append(imageBox);
	imageBoxes.add(imageBox);
	const screen = render(
		GiftImageEditEntry,
		{ expandable, onclick: vi.fn() },
		{ baseElement: imageBox },
	);
	const entry = screen.getByRole('button', { name: m.gift_image_edit() });
	const pill = screen.getByTestId('gift-image-edit-pill');
	return { entry, pill: () => pill.element() as HTMLElement };
}

/** Focuses the entry the way a keyboard user reaches it, so it matches `:focus-visible`. */
async function focusByKeyboard(entry: HTMLElement) {
	await userEvent.keyboard('{Shift}');
	entry.focus();
	expect(entry.matches(':focus-visible')).toBe(true);
}

function pillShows(pill: HTMLElement): boolean {
	const style = getComputedStyle(pill);
	return style.display !== 'none' && style.opacity === '1';
}

function pillHidden(pill: HTMLElement): boolean {
	const style = getComputedStyle(pill);
	return style.display === 'none' || style.opacity === '0';
}

describe('GiftImageEditEntry', () => {
	it('rests as an icon-only sticker and widens into the labelled pill on hover', async () => {
		await page.viewport(DESKTOP.width, DESKTOP.height);
		const { entry, pill } = renderEntry(true);
		await expect.element(entry).toBeVisible();
		expect(pillHidden(pill())).toBe(true);

		await userEvent.hover(entry);
		await expect.poll(() => pillShows(pill())).toBe(true);
		await expect.element(entry).toHaveAccessibleName(m.gift_image_edit());

		await userEvent.unhover(entry);
		await expect.poll(() => pillHidden(pill())).toBe(true);
	});

	it('widens into the labelled pill on keyboard focus', async () => {
		await page.viewport(DESKTOP.width, DESKTOP.height);
		const { entry, pill } = renderEntry(true);

		await focusByKeyboard(entry.element() as HTMLElement);
		await expect.poll(() => pillShows(pill())).toBe(true);
	});

	it('keeps the icon-only sticker on hover and focus when the image is not wide', async () => {
		await page.viewport(DESKTOP.width, DESKTOP.height);
		const { entry, pill } = renderEntry(false);

		await userEvent.hover(entry);
		await focusByKeyboard(entry.element() as HTMLElement);
		expect(getComputedStyle(pill()).display).toBe('none');
	});

	it('keeps the icon-only sticker on a phone even over a wide image', async () => {
		await page.viewport(PHONE.width, PHONE.height);
		const { entry, pill } = renderEntry(true);

		await userEvent.hover(entry);
		await focusByKeyboard(entry.element() as HTMLElement);
		expect(getComputedStyle(pill()).display).toBe('none');
	});
});
