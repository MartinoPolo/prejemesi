import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import { createDefaultWishlistSlots } from '$lib/modules/images/index.js';

vi.mock('$env/dynamic/public', () => ({ env: { PUBLIC_R2_URL: '/' } }));

const { default: WishlistCropEditor } = await import('./WishlistCropEditor.svelte');

describe('WishlistCropEditor loaded image', () => {
	it('stages removal and persists it only when the external form is submitted', async () => {
		const onsave = vi.fn();
		const screen = render(WishlistCropEditor, {
			imageKey: 'demo/backpack.jpg',
			imageSlots: createDefaultWishlistSlots(),
			themeEmoji: '🎁',
			title: 'Test wishlist',
			formId: 'crop-editor-form',
			onsave,
		});

		const change = screen.getByRole('button', { name: m.wishlist_image_change() });
		const remove = screen.getByRole('button', { name: m.wishlist_image_remove() });
		await expect.element(change).toBeVisible();
		await expect.element(remove).toBeVisible();
		expect(change.element()).toHaveClass('h-9');
		expect(remove.element()).toHaveClass('h-9');
		await expect.element(screen.getByText(m.image_upload_dropzone())).not.toBeInTheDocument();
		const dragOver = new DragEvent('dragover', { bubbles: true, cancelable: true });
		change.element().dispatchEvent(dragOver);
		expect(dragOver.defaultPrevented).toBe(true);

		await screen.getByRole('button', { name: m.wishlist_image_remove() }).click();
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
	});
});
