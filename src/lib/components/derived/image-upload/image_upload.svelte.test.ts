import '../../../../app.css';
import { cleanup, render } from 'vitest-browser-svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import {
	IMAGE_PREPARATION_FAILURES,
	ImagePreparationError,
} from '$lib/modules/uploads/prepare_image.js';
import type * as PrepareImageModule from '$lib/modules/uploads/prepare_image.js';
import type { UploadResult } from '$lib/modules/uploads/types.js';

const { prepareImageForUploadMock, uploadFileMock } = vi.hoisted(() => ({
	prepareImageForUploadMock: vi.fn(),
	uploadFileMock: vi.fn(),
}));
vi.mock('$lib/modules/uploads/prepare_image.js', async (importOriginal) => ({
	...(await importOriginal<typeof PrepareImageModule>()),
	prepareImageForUpload: prepareImageForUploadMock,
}));
vi.mock('$lib/modules/uploads/upload.js', () => ({ uploadFile: uploadFileMock }));

const { default: ImageUpload } = await import('./ImageUpload.svelte');

const renderableImage =
	'data:image/svg+xml,' +
	encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"/>');
const unrenderableImage = 'data:image/png;base64,bm90LWFuLWltYWdl';

function damagedJpeg(): File {
	return new File(['not a jpeg'], 'damaged.jpg', { type: 'image/jpeg' });
}

function renderableSvgFile(): File {
	return new File(
		['<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"/>'],
		'renderable.svg',
		{ type: 'image/svg+xml' },
	);
}

function selectFile(file: File) {
	const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
	const transfer = new DataTransfer();
	transfer.items.add(file);
	input.files = transfer.files;
	input.dispatchEvent(new Event('change', { bubbles: true }));
}

function uploadSucceeds() {
	prepareImageForUploadMock.mockImplementation(async (file: File) => file);
	uploadFileMock.mockResolvedValue({
		objectKey: 'gift-images/selected',
		publicUrl: renderableImage,
		deleteToken: 'delete-token',
	} satisfies UploadResult);
}

function failPreparation() {
	prepareImageForUploadMock.mockRejectedValueOnce(
		new ImagePreparationError(IMAGE_PREPARATION_FAILURES.unreadable),
	);
}

afterEach(() => {
	cleanup();
	prepareImageForUploadMock.mockReset();
	uploadFileMock.mockReset();
});

describe('ImageUpload failed preparation', () => {
	it('shows only the localized error, with no broken preview or alt text', async () => {
		failPreparation();
		const screen = render(ImageUpload, { props: { target: 'gift-image' } });

		selectFile(damagedJpeg());

		await expect.element(screen.getByText(m.image_upload_error_unreadable())).toBeVisible();
		await expect.element(screen.getByTestId('image-upload-preview')).not.toBeInTheDocument();
		await expect
			.element(screen.getByAltText(m.image_upload_preview_alt()))
			.not.toBeInTheDocument();
		await expect.element(screen.getByText(m.image_upload_dropzone())).toBeVisible();
		await expect
			.element(screen.getByRole('button', { name: m.image_upload_remove() }))
			.not.toBeInTheDocument();
	});

	it('keeps showing the existing image the form still holds', async () => {
		failPreparation();
		const screen = render(ImageUpload, {
			props: {
				target: 'gift-image',
				initialPreviewUrl: renderableImage,
			},
		});

		selectFile(damagedJpeg());

		await expect.element(screen.getByText(m.image_upload_error_unreadable())).toBeVisible();
		await expect
			.element(screen.getByTestId('image-upload-preview'))
			.toHaveAttribute('src', renderableImage);
	});
});

describe('ImageUpload failed upload', () => {
	it('restores the existing image and shows the localized error', async () => {
		prepareImageForUploadMock.mockImplementation(async (file: File) => file);
		uploadFileMock.mockRejectedValueOnce(new Error('Network down'));
		const onUpload = vi.fn();
		const screen = render(ImageUpload, {
			props: {
				target: 'gift-image',
				initialPreviewUrl: renderableImage,
				onUpload,
			},
		});

		selectFile(renderableSvgFile());

		await expect.element(screen.getByText(m.image_upload_error_failed())).toBeVisible();
		await expect
			.element(screen.getByTestId('image-upload-preview'))
			.toHaveAttribute('src', renderableImage);
		expect(onUpload).not.toHaveBeenCalled();
	});
});

describe('ImageUpload preview that cannot be rendered', () => {
	it('hides the broken preview but keeps the image removable', async () => {
		const onRemove = vi.fn();
		const screen = render(ImageUpload, {
			props: {
				target: 'gift-image',
				initialPreviewUrl: unrenderableImage,
				onRemove,
			},
		});

		await expect.element(screen.getByTestId('image-upload-preview')).not.toBeInTheDocument();
		await expect
			.element(screen.getByAltText(m.image_upload_preview_alt()))
			.not.toBeInTheDocument();
		await expect.element(screen.getByText(m.image_upload_dropzone())).toBeVisible();

		await screen.getByRole('button', { name: m.image_upload_remove() }).click();
		expect(onRemove).toHaveBeenCalledOnce();
	});

	it('hides an uploaded selection the browser cannot render but keeps it removable', async () => {
		uploadSucceeds();
		const onUpload = vi.fn();
		const onRemove = vi.fn();
		const screen = render(ImageUpload, {
			props: { target: 'gift-image', onUpload, onRemove },
		});

		selectFile(damagedJpeg());

		await vi.waitFor(() => expect(onUpload).toHaveBeenCalledOnce());
		await expect.element(screen.getByTestId('image-upload-preview')).not.toBeInTheDocument();
		await expect
			.element(screen.getByAltText(m.image_upload_preview_alt()))
			.not.toBeInTheDocument();
		await expect.element(screen.getByText(m.image_upload_dropzone())).toBeVisible();

		await screen.getByRole('button', { name: m.image_upload_remove() }).click();
		expect(onRemove).toHaveBeenCalledOnce();
		await expect
			.element(screen.getByRole('button', { name: m.image_upload_remove() }))
			.not.toBeInTheDocument();
	});

	it('shows the next selected image after an earlier preview failed', async () => {
		uploadSucceeds();
		const screen = render(ImageUpload, {
			props: {
				target: 'gift-image',
				initialPreviewUrl: unrenderableImage,
			},
		});
		await expect.element(screen.getByText(m.image_upload_dropzone())).toBeVisible();

		selectFile(renderableSvgFile());

		await expect
			.element(screen.getByTestId('image-upload-preview'))
			.toHaveAttribute('src', expect.stringMatching(/^blob:/));
		await expect.element(screen.getByTestId('image-upload-preview')).toBeVisible();
	});
});
