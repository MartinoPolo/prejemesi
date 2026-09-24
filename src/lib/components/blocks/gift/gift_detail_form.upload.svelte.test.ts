import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import type { UploadResult } from '$lib/modules/uploads/types.js';

vi.mock('$env/dynamic/public', () => ({
	env: { PUBLIC_R2_URL: 'data:image/svg+xml,%3Csvg%2F%3E' },
}));

const {
	uploadFileMock,
	pendingUploadsCommitMock,
	pendingUploadsDiscardAllMock,
	pendingUploadTracker,
} = vi.hoisted(() => ({
	uploadFileMock: vi.fn(),
	pendingUploadsCommitMock: vi.fn(),
	pendingUploadsDiscardAllMock: vi.fn(),
	pendingUploadTracker: {
		trackedKeys: new Set<string>(),
		retainedKey: null as string | null,
		deletedKeys: [] as string[],
		events: [] as string[],
	},
}));
vi.mock('$lib/modules/uploads/upload.js', () => ({
	uploadFile: uploadFileMock,
	createPendingUploads: () => ({
		track: (result: UploadResult) => {
			pendingUploadTracker.trackedKeys.add(result.objectKey);
			pendingUploadTracker.events.push(`track:${result.objectKey}`);
		},
		commit: pendingUploadsCommitMock.mockImplementation(async (finalKey: string | null) => {
			pendingUploadTracker.events.push(`commit:${finalKey ?? 'none'}`);
			pendingUploadTracker.retainedKey = finalKey;
			for (const key of pendingUploadTracker.trackedKeys) {
				if (key !== finalKey) {
					pendingUploadTracker.deletedKeys.push(key);
				}
			}
			pendingUploadTracker.trackedKeys.clear();
		}),
		discardAll: pendingUploadsDiscardAllMock.mockImplementation(async () => {
			pendingUploadTracker.events.push('discard');
			for (const key of pendingUploadTracker.trackedKeys) {
				pendingUploadTracker.deletedKeys.push(key);
			}
			pendingUploadTracker.trackedKeys.clear();
		}),
	}),
}));

const { default: GiftDetailForm } = await import('./GiftDetailForm.svelte');
const { default: GiftDetailModal } = await import('./GiftDetailModal.svelte');

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
	pendingUploadsCommitMock.mockClear();
	pendingUploadsDiscardAllMock.mockClear();
	pendingUploadTracker.trackedKeys.clear();
	pendingUploadTracker.retainedKey = null;
	pendingUploadTracker.deletedKeys = [];
	pendingUploadTracker.events = [];
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
		expect(
			screen
				.getByRole('button', { name: m.cancel() })
				.all()
				.every((button) => (button.element() as HTMLButtonElement).disabled),
		).toBe(true);
		await expect
			.element(screen.getByRole('radio', { name: m.gift_image_url_tab() }))
			.toBeDisabled();
		await expect
			.element(screen.getByRole('textbox', { name: m.gift_name_label() }))
			.toBeEnabled();

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

	it('keeps the uploaded key and changed manual crop across viewport changes', async () => {
		const pendingUpload = deferred<UploadResult>();
		const oncreate = vi.fn();
		uploadFileMock.mockReturnValueOnce(pendingUpload.promise);
		const { screen } = await renderCreateForm(oncreate);
		selectImage(document.querySelector<HTMLInputElement>('input[type="file"]')!);
		pendingUpload.resolve(uploaded);
		await expect.element(screen.getByTestId('image-upload-preview')).toBeVisible();

		const nameInput = screen.getByRole('textbox', { name: m.gift_name_label() });
		await nameInput.fill('Draft survives resize');
		await screen.getByRole('radio', { name: m.image_fit_manual() }).click();
		const cropStage = screen.getByTestId('crop-stage');
		await expect.element(cropStage).toHaveAttribute('role', 'button');
		const cropImage = cropStage.element().querySelector('img')!;
		Object.defineProperties(cropImage, {
			naturalWidth: { configurable: true, value: 400 },
			naturalHeight: { configurable: true, value: 300 },
		});
		cropImage.dispatchEvent(new Event('load'));
		await expect.element(screen.getByTestId('crop-stage-window')).toBeVisible();
		cropStage.element().focus();
		cropStage
			.element()
			.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true }));
		await page.viewport(1280, 800);
		await page.viewport(390, 844);

		await expect.element(nameInput).toHaveValue('Draft survives resize');
		expect(uploadFileMock).toHaveBeenCalledTimes(1);
		expect(screen.getByTestId('gift-image-column').all()).toHaveLength(1);
		await screen.getByRole('button', { name: m.gift_add_title() }).first().click();
		const payload = oncreate.mock.calls[0]![0];
		expect(payload.imageKey).toBe(uploaded.objectKey);
		expect(payload.imageMeta.targets.square.cropRect).not.toEqual({ x: 0, y: 0, w: 1, h: 1 });
		expect(payload.imageMeta.targets.square.zoom).toBeGreaterThan(1);
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
		expect(pendingUploadsCommitMock).toHaveBeenCalledWith(uploaded.objectKey);
	});

	it('commits the immutable submitted image snapshot while save controls are locked', async () => {
		const abandonedUpload: UploadResult = {
			...uploaded,
			objectKey: 'gift-images/abandoned.png',
			deleteToken: 'delete-abandoned',
		};
		const selectedUpload: UploadResult = {
			...uploaded,
			objectKey: 'gift-images/selected.png',
			deleteToken: 'delete-selected',
		};
		const save = deferred<boolean>();
		const oncreate = vi.fn().mockReturnValue(save.promise);
		uploadFileMock.mockResolvedValueOnce(abandonedUpload).mockResolvedValueOnce(selectedUpload);
		const { screen } = await renderCreateForm(oncreate);
		const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]')!;
		selectImage(fileInput, 'abandoned.png');
		await vi.waitFor(() => expect(uploadFileMock).toHaveBeenCalledTimes(1));
		selectImage(fileInput, 'selected.png');
		await vi.waitFor(() => expect(uploadFileMock).toHaveBeenCalledTimes(2));

		await screen.getByRole('button', { name: m.gift_add_title() }).first().click();
		expect(oncreate).toHaveBeenCalledOnce();
		const submittedPayload = oncreate.mock.calls[0]![0];
		expect(submittedPayload.imageKey).toBe(selectedUpload.objectKey);
		await expect
			.element(screen.getByRole('radio', { name: m.gift_image_url_tab() }))
			.toBeDisabled();
		await expect
			.element(screen.getByRole('textbox', { name: m.gift_name_label() }))
			.toBeDisabled();
		await expect
			.element(screen.getByRole('radio', { name: m.image_fit_manual() }))
			.toBeDisabled();
		const lockedFileInput = document.querySelector<HTMLInputElement>('input[type="file"]')!;
		expect(lockedFileInput.disabled).toBe(true);
		selectImage(lockedFileInput, 'during-save.png');
		expect(uploadFileMock).toHaveBeenCalledTimes(2);
		const removeButton = screen.getByRole('button', { name: m.image_upload_remove() });
		await expect.element(removeButton).toBeDisabled();
		await removeButton.click({ force: true });
		for (const submitButton of submitButtons()) {
			submitButton.disabled = false;
			submitButton.click();
		}
		expect(oncreate).toHaveBeenCalledOnce();

		save.resolve(true);
		await vi.waitFor(() =>
			expect(pendingUploadsCommitMock).toHaveBeenCalledWith(selectedUpload.objectKey),
		);
		expect(pendingUploadTracker.retainedKey).toBe(selectedUpload.objectKey);
		expect(pendingUploadTracker.deletedKeys).toEqual([abandonedUpload.objectKey]);
		expect(submittedPayload.imageKey).toBe(selectedUpload.objectKey);
	});

	it('closes a successful modal only after upload cleanup commits', async () => {
		const cleanup = deferred<void>();
		pendingUploadsCommitMock.mockImplementationOnce(async (finalKey: string | null) => {
			pendingUploadTracker.events.push(`commit:start:${finalKey ?? 'none'}`);
			await cleanup.promise;
			pendingUploadTracker.events.push(`commit:end:${finalKey ?? 'none'}`);
			pendingUploadTracker.trackedKeys.clear();
		});
		uploadFileMock.mockResolvedValueOnce(uploaded);
		const screen = await render(GiftDetailModal, {
			...baseProps,
			open: true,
			oncreate: vi.fn().mockResolvedValue(true),
		});
		await screen.getByRole('textbox', { name: m.gift_name_label() }).fill('Tracked modal gift');
		selectImage(document.querySelector<HTMLInputElement>('input[type="file"]')!);
		await expect.element(screen.getByTestId('image-upload-preview')).toBeVisible();

		await screen.getByRole('button', { name: m.gift_add_title() }).first().click();
		await vi.waitFor(() => expect(pendingUploadsCommitMock).toHaveBeenCalledOnce());
		await expect.element(screen.getByRole('dialog')).toBeVisible();
		expect(pendingUploadTracker.events).toContain(`commit:start:${uploaded.objectKey}`);

		cleanup.resolve();
		await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
		await vi.waitFor(() => expect(pendingUploadsDiscardAllMock).toHaveBeenCalledOnce());
		expect(pendingUploadTracker.events).toEqual([
			`track:${uploaded.objectKey}`,
			`commit:start:${uploaded.objectKey}`,
			`commit:end:${uploaded.objectKey}`,
			'discard',
		]);
		expect(pendingUploadTracker.deletedKeys).not.toContain(uploaded.objectKey);
	});

	it('keeps every modal exit inert while a save owns the pending upload', async () => {
		await page.viewport(390, 844);
		const save = deferred<boolean>();
		uploadFileMock.mockResolvedValueOnce(uploaded);
		const screen = await render(GiftDetailModal, {
			...baseProps,
			open: true,
			oncreate: vi.fn().mockReturnValue(save.promise),
		});
		await screen.getByRole('textbox', { name: m.gift_name_label() }).fill('Pending save gift');
		selectImage(document.querySelector<HTMLInputElement>('input[type="file"]')!);
		await expect.element(screen.getByTestId('image-upload-preview')).toBeVisible();
		await screen.getByRole('button', { name: m.gift_add_title() }).first().click();

		const cancelButton = screen.getByRole('button', { name: m.cancel() }).first();
		await expect.element(cancelButton).toBeDisabled();
		await cancelButton.click({ force: true });
		await screen.getByRole('button', { name: m.close() }).first().click();
		await userEvent.keyboard('{Escape}');
		const overlay = document.querySelector<HTMLElement>('[data-slot="dialog-overlay"]')!;
		overlay.dispatchEvent(
			new PointerEvent('pointerdown', {
				bubbles: true,
				cancelable: true,
				pointerType: 'mouse',
			}),
		);
		overlay.dispatchEvent(
			new PointerEvent('pointerup', {
				bubbles: true,
				cancelable: true,
				pointerType: 'mouse',
			}),
		);

		await expect.element(screen.getByRole('dialog')).toBeVisible();
		expect(pendingUploadsCommitMock).not.toHaveBeenCalled();
		expect(pendingUploadsDiscardAllMock).not.toHaveBeenCalled();
		expect(pendingUploadTracker.trackedKeys).toContain(uploaded.objectKey);

		save.resolve(true);
		await vi.waitFor(() =>
			expect(pendingUploadsCommitMock).toHaveBeenCalledWith(uploaded.objectKey),
		);
		await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
		expect(pendingUploadTracker.deletedKeys).not.toContain(uploaded.objectKey);
	});

	it('retains a failed save upload until the draft is discarded', async () => {
		const oncreate = vi.fn().mockResolvedValue(false);
		uploadFileMock.mockResolvedValueOnce(uploaded);
		const { screen } = await renderCreateForm(oncreate);
		selectImage(document.querySelector<HTMLInputElement>('input[type="file"]')!);
		await expect.element(screen.getByTestId('image-upload-preview')).toBeVisible();

		await screen.getByRole('button', { name: m.gift_add_title() }).first().click();
		expect(oncreate).toHaveBeenCalledOnce();
		expect(pendingUploadsCommitMock).not.toHaveBeenCalled();
		expect(pendingUploadsDiscardAllMock).not.toHaveBeenCalled();

		await screen.unmount();
		expect(pendingUploadsDiscardAllMock).toHaveBeenCalledOnce();
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
				.element(screen.getByRole('radio', { name: m.gift_image_url_tab() }))
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
