import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import type { UploadResult } from '$lib/modules/uploads/types.js';
import type * as PrepareImageModule from '$lib/modules/uploads/prepare_image.js';
import { env } from '$env/dynamic/public';

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
// Preparation has its own tests.
vi.mock('$lib/modules/uploads/prepare_image.js', async (importOriginal) => ({
	...(await importOriginal<typeof PrepareImageModule>()),
	prepareImageForUpload: async (file: File) => file,
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

const { default: GiftDetailForm } = await import('./GiftDetailFormTestFixture.svelte');
const { default: GiftDetailModal } = await import('./GiftDetailModalTestHost.svelte');

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
		'data:image/svg+xml,' +
		encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"/>'),
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

// A decodable image, because ImageUpload hides previews the browser cannot render.
const ONE_PIXEL_PNG = Uint8Array.from(
	atob(
		'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
	),
	(character) => character.charCodeAt(0),
);

function selectImage(input: HTMLInputElement, name = 'selected.png') {
	const transfer = new DataTransfer();
	transfer.items.add(new File([ONE_PIXEL_PNG], name, { type: 'image/png' }));
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

function fileInput(): HTMLInputElement {
	return document.querySelector<HTMLInputElement>('input[type="file"]')!;
}

type RenderedScreen = Pick<
	Awaited<ReturnType<typeof renderCreateForm>>['screen'],
	'getByRole' | 'getByTestId'
>;

function addTile(screen: RenderedScreen) {
	return screen.getByTestId('gift-image-strip-add');
}

function coverTile(screen: RenderedScreen) {
	return screen.getByRole('button', {
		name: m.gift_image_strip_select_cover({ position: 1 }),
		exact: true,
	});
}

describe('GiftDetailForm pending image uploads', () => {
	it('keeps Save, Cancel and adding guarded while an image uploads', async () => {
		const pendingUpload = deferred<UploadResult>();
		uploadFileMock.mockReturnValueOnce(pendingUpload.promise);
		const { screen, oncreate } = await renderCreateForm();
		selectImage(fileInput());

		await expect.element(screen.getByTestId('gift-image-strip-uploading')).toBeVisible();
		const buttons = submitButtons();
		expect(buttons).toHaveLength(1);
		await vi.waitFor(() => expect(buttons.every((button) => button.disabled)).toBe(true));
		await expect
			.element(screen.getByTestId('gift-editor-keyboard-save'))
			.toHaveAttribute('disabled');
		await expect.element(screen.getByRole('button', { name: m.cancel() })).toBeDisabled();
		await expect.element(addTile(screen)).toHaveAttribute('aria-disabled', 'true');
		await expect
			.element(screen.getByRole('textbox', { name: m.gift_name_label() }))
			.toBeEnabled();

		// Prove the handler itself is guarded, independent of the button's disabled attribute.
		const submit = buttons[0]!;
		submit.disabled = false;
		submit.click();
		expect(oncreate).not.toHaveBeenCalled();

		pendingUpload.resolve(uploaded);
		await expect.element(coverTile(screen)).toBeVisible();
		await vi.waitFor(() =>
			expect(submitButtons().every((button) => !button.disabled)).toBe(true),
		);
	});

	it('keeps the uploaded key and changed framing across viewport changes', async () => {
		// The storage base serves a real photo for the uploaded key, so the editor loads and
		// measures it as it does in the app.
		const storageBase = env.PUBLIC_R2_URL;
		env.PUBLIC_R2_URL = `${location.origin}/tests/e2e/fixtures`;
		onTestFinished(() => {
			env.PUBLIC_R2_URL = storageBase;
		});
		const uploadedPhoto: UploadResult = { ...uploaded, objectKey: 'sample-image.jpg' };
		await page.viewport(1280, 900);
		const oncreate = vi.fn();
		uploadFileMock.mockResolvedValueOnce(uploadedPhoto);
		const { screen } = await renderCreateForm(oncreate);
		selectImage(fileInput());
		await expect.element(coverTile(screen)).toBeVisible();

		const nameInput = screen.getByRole('textbox', { name: m.gift_name_label() });
		await nameInput.fill('Draft survives resize');
		await screen.getByTestId('gift-image-edit-entry').click();
		await expect.element(screen.getByTestId('gift-framing-zoom-square')).toBeEnabled();
		const cardSurface = screen
			.getByTestId('gift-framing-view-square')
			.getByTestId('crop-pan-surface');
		// The card view's window reaches its photo as the object-position and zoom transform.
		const cardFraming = () =>
			(cardSurface.element() as HTMLElement).querySelector('img')!.getAttribute('style');
		const openingFraming = cardFraming();
		(cardSurface.element() as HTMLElement).focus();
		await userEvent.keyboard('+');
		await expect
			.element(screen.getByTestId('gift-framing-status-square'))
			.toHaveTextContent(m.gift_image_framing_custom());
		const changedFraming = cardFraming();
		expect(changedFraming).not.toBe(openingFraming);

		// Only the desktop side-by-side layout shows the same-square panel, so its presence proves
		// the layout switched before the framing is read again.
		const sameSquarePanel = screen.getByTestId('gift-framing-same-square');
		for (const { width, height, sideBySide } of [
			{ width: 390, height: 844, sideBySide: false },
			{ width: 1280, height: 900, sideBySide: true },
		]) {
			await page.viewport(width, height);
			if (sideBySide) {
				await expect.element(sameSquarePanel).toBeInTheDocument();
			} else {
				await expect.element(sameSquarePanel).not.toBeInTheDocument();
			}
			await expect.poll(cardFraming).toBe(changedFraming);
			await expect
				.element(screen.getByTestId('gift-framing-status-square'))
				.toHaveTextContent(m.gift_image_framing_custom());
		}
		await screen.getByRole('button', { name: m.gift_context_back() }).click();

		await expect.element(nameInput).toHaveValue('Draft survives resize');
		expect(uploadFileMock).toHaveBeenCalledTimes(1);
		await screen.getByRole('button', { name: m.gift_add_title() }).click();
		const payload = oncreate.mock.calls[0]![0];
		expect(payload.images).toHaveLength(1);
		const [submittedImage] = payload.images;
		expect(submittedImage.imageKey).toBe(uploadedPhoto.objectKey);
		expect(submittedImage.imageMeta.targets.square.zoom).toBeGreaterThan(1);
	});

	it('enables saving after completion and submits the exact uploaded key', async () => {
		const pendingUpload = deferred<UploadResult>();
		uploadFileMock.mockReturnValueOnce(pendingUpload.promise);
		const { screen, oncreate } = await renderCreateForm();
		selectImage(fileInput());

		await vi.waitFor(() =>
			expect(submitButtons().every((button) => button.disabled)).toBe(true),
		);
		pendingUpload.resolve(uploaded);

		const submitButton = screen.getByRole('button', { name: m.gift_add_title() });
		await expect.element(submitButton).toBeEnabled();
		await submitButton.click();
		expect(oncreate).toHaveBeenCalledWith(
			expect.objectContaining({
				images: [
					expect.objectContaining({
						imageKey: uploaded.objectKey,
						imageUrl: uploaded.publicUrl,
					}),
				],
			}),
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
		selectImage(fileInput(), 'abandoned.png');
		await expect.element(coverTile(screen)).toBeVisible();
		await screen
			.getByRole('button', { name: m.gift_image_strip_remove_label({ position: 1 }) })
			.click();
		selectImage(fileInput(), 'selected.png');
		await vi.waitFor(() => expect(uploadFileMock).toHaveBeenCalledTimes(2));
		await expect.element(coverTile(screen)).toBeVisible();

		await screen.getByRole('button', { name: m.gift_add_title() }).click();
		expect(oncreate).toHaveBeenCalledOnce();
		const submittedPayload = oncreate.mock.calls[0]![0];
		expect(
			submittedPayload.images.map((image: { imageKey: string }) => image.imageKey),
		).toEqual([selectedUpload.objectKey]);
		await expect
			.element(screen.getByRole('textbox', { name: m.gift_name_label() }))
			.toBeDisabled();
		await expect.element(addTile(screen)).toHaveAttribute('aria-disabled', 'true');
		await expect
			.element(screen.getByTestId('gift-image-edit-entry'))
			.toHaveAttribute('disabled');
		expect(fileInput().disabled).toBe(true);
		selectImage(fileInput(), 'during-save.png');
		expect(uploadFileMock).toHaveBeenCalledTimes(2);
		const removeButton = screen.getByRole('button', {
			name: m.gift_image_strip_remove_label({ position: 1 }),
		});
		await expect.element(removeButton).toHaveAttribute('aria-disabled', 'true');
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
		expect(
			submittedPayload.images.map((image: { imageKey: string }) => image.imageKey),
		).toEqual([selectedUpload.objectKey]);
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
		selectImage(fileInput());
		await expect.element(coverTile(screen)).toBeVisible();

		await screen.getByRole('button', { name: m.gift_add_title() }).click();
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
		selectImage(fileInput());
		await expect.element(coverTile(screen)).toBeVisible();
		await screen.getByRole('button', { name: m.gift_add_title() }).click();

		const cancelButton = screen.getByRole('button', { name: m.cancel() });
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
		selectImage(fileInput());
		await expect.element(coverTile(screen)).toBeVisible();

		await screen.getByRole('button', { name: m.gift_add_title() }).click();
		expect(oncreate).toHaveBeenCalledOnce();
		expect(pendingUploadsCommitMock).not.toHaveBeenCalled();
		expect(pendingUploadsDiscardAllMock).not.toHaveBeenCalled();

		await screen.unmount();
		expect(pendingUploadsDiscardAllMock).toHaveBeenCalledOnce();
	});

	it.each(['failed', 'aborted'])(
		'unlocks Save and adding when an upload is %s',
		async (outcome) => {
			const pendingUpload = deferred<UploadResult>();
			uploadFileMock.mockReturnValueOnce(pendingUpload.promise);
			const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
			const { screen } = await renderCreateForm();
			selectImage(fileInput());
			await vi.waitFor(() =>
				expect(submitButtons().every((button) => button.disabled)).toBe(true),
			);

			pendingUpload.reject(
				new Error(outcome === 'aborted' ? 'Upload was aborted' : 'Upload failed'),
			);

			await vi.waitFor(() =>
				expect(submitButtons().every((button) => !button.disabled)).toBe(true),
			);
			await expect.element(addTile(screen)).toHaveAttribute('aria-disabled', 'false');
			consoleError.mockRestore();
		},
	);

	it('ignores another selected file while an image upload is active', async () => {
		const pendingUpload = deferred<UploadResult>();
		uploadFileMock.mockReturnValueOnce(pendingUpload.promise);
		const { screen } = await renderCreateForm();
		selectImage(fileInput(), 'first.png');
		await expect.element(screen.getByTestId('gift-image-strip-uploading')).toBeVisible();

		selectImage(fileInput(), 'second.png');

		expect(uploadFileMock).toHaveBeenCalledTimes(1);
		pendingUpload.resolve(uploaded);
		await vi.waitFor(() =>
			expect(submitButtons().every((button) => !button.disabled)).toBe(true),
		);
		await expect
			.element(
				screen.getByRole('button', {
					name: m.gift_image_strip_select({ position: 2 }),
					exact: true,
				}),
			)
			.not.toBeInTheDocument();
	});
});
