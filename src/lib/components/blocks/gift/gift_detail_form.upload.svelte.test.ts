import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import type { UploadResult } from '$lib/modules/uploads/types.js';

vi.mock('$env/dynamic/public', () => ({
	env: { PUBLIC_R2_URL: 'data:image/svg+xml,%3Csvg%2F%3E' },
}));

const uploadFileMock = vi.hoisted(() => vi.fn());
vi.mock('$lib/modules/uploads/upload.js', () => ({
	uploadFile: uploadFileMock,
	createPendingUploads: () => ({
		track: vi.fn(),
		commit: vi.fn().mockResolvedValue(undefined),
		discardAll: vi.fn().mockResolvedValue(undefined),
	}),
}));

const { default: GiftDetailForm } = await import('./GiftDetailForm.svelte');

const baseProps = {
	mode: 'create' as const,
	gift: null,
	wishlistId: 'wishlist-1',
	priorityLevels: [],
	role: 'recipient' as const,
	postShareLocked: false,
	canDelete: false,
	isSubmitting: false,
	isDeleting: false,
};

const uploaded: UploadResult = {
	objectKey: 'gift-images/exact-uploaded-key.png',
	publicUrl:
		'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg"/>'),
	deleteToken: 'delete-token',
};

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	return { promise, resolve, reject };
}

function selectImage(input: HTMLInputElement, name = 'selected.png') {
	const transfer = new DataTransfer();
	transfer.items.add(new File(['image'], name, { type: 'image/png' }));
	input.files = transfer.files;
	input.dispatchEvent(new Event('change', { bubbles: true }));
}

async function renderCreateForm(oncreate = vi.fn()) {
	const screen = await render(GiftDetailForm, { ...baseProps, oncreate });
	await screen.getByRole('textbox', { name: m.gift_name_label() }).fill('Pending image gift');
	return { screen, oncreate };
}

function submitButtons(): HTMLButtonElement[] {
	return [...document.querySelectorAll<HTMLButtonElement>('button')].filter(
		(button) => button.textContent?.trim() === m.gift_add_title(),
	);
}

beforeEach(() => {
	uploadFileMock.mockReset();
});

describe('GiftDetailForm pending image uploads', () => {
	it('shows the selected preview while desktop and mobile submit paths and source switching stay guarded', async () => {
		const pendingUpload = deferred<UploadResult>();
		uploadFileMock.mockReturnValueOnce(pendingUpload.promise);
		const { screen, oncreate } = await renderCreateForm();

		selectImage(document.querySelector<HTMLInputElement>('input[type="file"]')!);

		await expect.element(screen.getByTestId('image-upload-preview')).toBeVisible();
		const buttons = submitButtons();
		expect(buttons).toHaveLength(2);
		await vi.waitFor(() => expect(buttons.every((button) => button.disabled)).toBe(true));
		await expect
			.element(screen.getByRole('button', { name: m.gift_image_url_tab() }))
			.toBeDisabled();

		// Prove the handler itself is guarded, independent of the button's disabled attribute.
		const desktopSubmit = buttons[0]!;
		desktopSubmit.disabled = false;
		desktopSubmit.click();
		expect(oncreate).not.toHaveBeenCalled();

		pendingUpload.resolve(uploaded);
		await vi.waitFor(() =>
			expect(submitButtons().every((button) => !button.disabled)).toBe(true),
		);
	});

	it('enables saving after completion and submits the exact uploaded key', async () => {
		const pendingUpload = deferred<UploadResult>();
		uploadFileMock.mockReturnValueOnce(pendingUpload.promise);
		const { screen, oncreate } = await renderCreateForm();
		selectImage(document.querySelector<HTMLInputElement>('input[type="file"]')!);

		await vi.waitFor(() =>
			expect(submitButtons().every((button) => button.disabled)).toBe(true),
		);
		pendingUpload.resolve(uploaded);

		const submitButton = screen.getByRole('button', { name: m.gift_add_title() }).first();
		await expect.element(submitButton).toBeEnabled();
		await submitButton.click();
		expect(oncreate).toHaveBeenCalledWith(
			expect.objectContaining({ imageKey: uploaded.objectKey, imageUrl: uploaded.publicUrl }),
		);
	});

	it.each(['failed', 'aborted'])(
		'unlocks both submit paths when an upload is %s',
		async (outcome) => {
			const pendingUpload = deferred<UploadResult>();
			uploadFileMock.mockReturnValueOnce(pendingUpload.promise);
			const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
			const { screen } = await renderCreateForm();
			selectImage(document.querySelector<HTMLInputElement>('input[type="file"]')!);
			await vi.waitFor(() =>
				expect(submitButtons().every((button) => button.disabled)).toBe(true),
			);

			pendingUpload.reject(
				new Error(outcome === 'aborted' ? 'Upload was aborted' : 'Upload failed'),
			);

			await vi.waitFor(() =>
				expect(submitButtons().every((button) => !button.disabled)).toBe(true),
			);
			await expect
				.element(screen.getByRole('button', { name: m.gift_image_url_tab() }))
				.toBeEnabled();
			consoleError.mockRestore();
		},
	);

	it('ignores another dropped file while the selected image upload is active', async () => {
		const pendingUpload = deferred<UploadResult>();
		uploadFileMock.mockReturnValueOnce(pendingUpload.promise);
		const { screen } = await renderCreateForm();
		selectImage(document.querySelector<HTMLInputElement>('input[type="file"]')!, 'first.png');
		await expect.element(screen.getByTestId('image-upload-preview')).toBeVisible();

		const transfer = new DataTransfer();
		transfer.items.add(new File(['second'], 'second.png', { type: 'image/png' }));
		screen
			.getByRole('button', { name: m.image_upload_aria() })
			.element()
			.dispatchEvent(
				new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }),
			);

		expect(uploadFileMock).toHaveBeenCalledTimes(1);
		pendingUpload.resolve(uploaded);
		await vi.waitFor(() =>
			expect(submitButtons().every((button) => !button.disabled)).toBe(true),
		);
	});
});
