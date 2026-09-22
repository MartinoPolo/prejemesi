import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPixelAssertions } from '../../../../../tests/helpers/pixel-assertions.mjs';
import { page } from 'vitest/browser';
import * as m from '$lib/paraglide/messages.js';
import { createDefaultWishlistSlots } from '$lib/modules/images/index.js';

vi.mock('$env/dynamic/public', () => ({ env: { PUBLIC_R2_URL: '/' } }));

const { default: WishlistCropEditor } = await import('./WishlistCropEditor.svelte');
const { expectPixelsNear } = createPixelAssertions(expect);

afterEach(async () => page.viewport(1280, 720));

describe('WishlistCropEditor loaded image', () => {
	it('stages removal, reports dirty state, and persists only on external submit', async () => {
		const onsave = vi.fn();
		const ondirtychange = vi.fn();
		const screen = render(WishlistCropEditor, {
			imageKey: 'demo/v1/backpack.jpg',
			imageSlots: createDefaultWishlistSlots(),
			themeEmoji: '🎁',
			title: 'Test wishlist',
			formId: 'crop-editor-form',
			onsave,
			ondirtychange,
		});

		const change = screen.getByRole('button', { name: m.wishlist_image_change() });
		const remove = screen.getByRole('button', { name: m.wishlist_image_remove() });
		await expect.element(change).toBeVisible();
		await expect.element(remove).toBeVisible();
		expect(change.element().getBoundingClientRect().height).toBeGreaterThan(0);
		expect(remove.element().getBoundingClientRect().height).toBeGreaterThan(0);
		await expect.element(screen.getByText(m.image_upload_dropzone())).not.toBeInTheDocument();
		const dragOver = new DragEvent('dragover', { bubbles: true, cancelable: true });
		change.element().dispatchEvent(dragOver);
		expect(dragOver.defaultPrevented).toBe(true);

		await vi.waitFor(() => expect(ondirtychange).toHaveBeenLastCalledWith(false));
		await screen.getByRole('button', { name: m.wishlist_image_remove() }).click();
		await vi.waitFor(() => expect(ondirtychange).toHaveBeenLastCalledWith(true));
		await expect
			.element(screen.getByRole('button', { name: m.image_upload_aria() }))
			.toBeVisible();
		await expect.element(screen.getByText(m.image_upload_dropzone())).toBeVisible();
		expect(onsave).not.toHaveBeenCalled();

		document
			.getElementById('crop-editor-form')!
			.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
		expect(onsave).toHaveBeenCalledOnce();
		expect(onsave).toHaveBeenCalledWith({ imageKey: null, imageSlots: null });
		await vi.waitFor(() => expect(ondirtychange).toHaveBeenLastCalledWith(false));
	});

	it('keeps adjacent change and remove actions at the contextual control size', async () => {
		const screen = render(WishlistCropEditor, {
			imageKey: 'demo/v1/backpack.jpg',
			imageSlots: createDefaultWishlistSlots(),
			themeEmoji: '🎁',
			title: 'Test wishlist',
			onsave: vi.fn(),
		});
		const change = screen.getByRole('button', { name: m.wishlist_image_change() });
		const remove = screen.getByRole('button', { name: m.wishlist_image_remove() });

		await page.viewport(390, 720);
		expectPixelsNear(change.element().getBoundingClientRect().height, 40);
		expectPixelsNear(remove.element().getBoundingClientRect().height, 40);
		await page.viewport(1280, 720);
		expectPixelsNear(change.element().getBoundingClientRect().height, 32);
		expectPixelsNear(remove.element().getBoundingClientRect().height, 32);
	});

	it('returns to clean when an image setting is restored to its baseline', async () => {
		const ondirtychange = vi.fn();
		const screen = render(WishlistCropEditor, {
			imageKey: 'demo/v1/backpack.jpg',
			imageSlots: createDefaultWishlistSlots(),
			themeEmoji: '🎁',
			title: 'Test wishlist',
			onsave: vi.fn(),
			ondirtychange,
		});

		await vi.waitFor(() => expect(ondirtychange).toHaveBeenLastCalledWith(false));
		await screen.getByRole('radio', { name: m.image_fit_fit() }).click();
		await vi.waitFor(() => expect(ondirtychange).toHaveBeenLastCalledWith(true));
		await screen.getByRole('radio', { name: m.image_fit_fill() }).click();
		await vi.waitFor(() => expect(ondirtychange).toHaveBeenLastCalledWith(false));
	});
});
