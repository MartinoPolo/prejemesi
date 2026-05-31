import { authorizeUpload } from './uploads.remote.js';
import type { UploadTarget } from '$lib/server/storage/r2.js';
import type { AllowedContentType } from '$lib/server/storage/r2.js';
import type { UploadResult, UploadProgress } from './types.js';

/**
 * Callback invoked as upload progress changes.
 */
export type UploadProgressCallback = (progress: UploadProgress) => void;

function isAllowedContentType(value: string): value is AllowedContentType {
	const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
	return allowed.includes(value);
}

/**
 * Uploads a file to R2 storage via the server upload flow:
 * 1. Requests authorization (validates + generates object key) via server command
 * 2. Uploads the file directly to the upload API route
 * 3. Returns the object key and public URL
 */
export async function uploadFile(
	file: File,
	target: UploadTarget,
	onProgress?: UploadProgressCallback,
): Promise<UploadResult> {
	const report = (partial: Partial<UploadProgress>) => {
		onProgress?.({
			status: 'idle',
			percentage: 0,
			...partial,
		});
	};

	try {
		// Validate content type client-side before sending to server
		if (!isAllowedContentType(file.type)) {
			throw new Error(`Invalid file type: ${file.type}. Allowed: JPEG, PNG, WebP, GIF`);
		}

		// Step 1: Request authorization from server
		report({ status: 'authorizing', percentage: 0 });
		const authorization = await authorizeUpload({
			target,
			fileName: file.name,
			contentType: file.type,
			fileSize: file.size,
		});

		// Step 2: Upload file to the upload API route
		report({ status: 'uploading', percentage: 0 });

		const uploadResult = await uploadWithProgress(
			authorization.uploadUrl,
			file,
			(percentage) => {
				report({ status: 'uploading', percentage });
			},
		);

		if (!uploadResult.ok) {
			throw new Error(`Upload failed with status ${String(uploadResult.status)}`);
		}

		// Step 3: Complete
		report({ status: 'complete', percentage: 100 });

		return {
			objectKey: authorization.objectKey,
			publicUrl: authorization.publicUrl,
		};
	} catch (thrown) {
		const errorMessage = thrown instanceof Error ? thrown.message : 'Upload failed';
		report({ status: 'error', percentage: 0, errorMessage });
		throw thrown;
	}
}

/**
 * Uploads a file with progress tracking using XMLHttpRequest.
 */
function uploadWithProgress(
	url: string,
	file: File,
	onProgress: (percentage: number) => void,
): Promise<{ ok: boolean; status: number }> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open('PUT', url);
		xhr.setRequestHeader('Content-Type', file.type);

		xhr.upload.addEventListener('progress', (event) => {
			if (event.lengthComputable) {
				const percentage = Math.round((event.loaded / event.total) * 100);
				onProgress(percentage);
			}
		});

		xhr.addEventListener('load', () => {
			resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status });
		});

		xhr.addEventListener('error', () => {
			reject(new Error('Network error during upload'));
		});

		xhr.addEventListener('abort', () => {
			reject(new Error('Upload was aborted'));
		});

		xhr.send(file);
	});
}
