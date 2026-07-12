import { authorizeUpload } from './uploads.remote.js';
import type { UploadTarget } from '$lib/server/storage/r2.js';
import {
	isAllowedContentType,
	UPLOAD_API_BASE,
	type UploadResult,
	type UploadProgress,
} from './types.js';

/**
 * Callback invoked as upload progress changes.
 */
export type UploadProgressCallback = (progress: UploadProgress) => void;

/**
 * Uploads a file to R2 storage via the server upload flow:
 * 1. Requests authorization (validates + generates object key) via server command
 * 2. PUTs the file to the authorized URL – directly to R2 via a presigned URL,
 *    or to the same-origin proxy route in local dev (REQ-1)
 * 3. Returns the object key, public URL, and a cleanup delete token
 */
export async function uploadFile(
	file: File,
	target: UploadTarget,
	onProgress?: UploadProgressCallback,
	signal?: AbortSignal,
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

		if (signal?.aborted === true) {
			throw new Error('Upload was aborted');
		}

		// Step 1: Request authorization from server
		report({ status: 'authorizing', percentage: 0 });
		const authorization = await authorizeUpload({
			target,
			fileName: file.name,
			contentType: file.type,
			fileSize: file.size,
		});

		// Step 2: PUT the file to the authorized URL (presigned R2 or proxy route)
		report({ status: 'uploading', percentage: 0 });

		const uploadResult = await uploadWithProgress(
			authorization.uploadUrl,
			file,
			authorization.uploadToken,
			(percentage) => {
				report({ status: 'uploading', percentage });
			},
			signal,
		);

		if (!uploadResult.ok) {
			throw new Error(`Upload failed with status ${String(uploadResult.status)}`);
		}

		// Step 3: Complete
		report({ status: 'complete', percentage: 100 });

		return {
			objectKey: authorization.objectKey,
			publicUrl: authorization.publicUrl,
			deleteToken: authorization.deleteToken,
		};
	} catch (thrown) {
		const errorMessage = thrown instanceof Error ? thrown.message : 'Upload failed';
		report({ status: 'error', percentage: 0, errorMessage });
		throw thrown;
	}
}

/**
 * Deletes an uploaded object that never got referenced (cancelled or replaced
 * before save – REQ-6). Authorized by the delete token minted alongside the
 * upload, so only the uploader can remove it. Best-effort: failures are
 * swallowed – a stray object must never break the user flow.
 */
export async function deleteUploadedObject(objectKey: string, deleteToken: string): Promise<void> {
	try {
		await fetch(`${UPLOAD_API_BASE}/${objectKey}`, {
			method: 'DELETE',
			headers: { 'X-Upload-Token': deleteToken },
			keepalive: true,
		});
	} catch {
		// Cleanup is best-effort by design.
	}
}

/**
 * Tracks objects uploaded during one edit session (dialog/form) that are not
 * persisted yet. `commit(finalKey)` deletes every tracked object except the one
 * that was saved; `discardAll()` deletes them all (cancel/unmount). Both clear
 * the tracker, so calling `discardAll` after `commit` is a safe no-op.
 */
export function createPendingUploads() {
	const pending = new Map<string, string>();

	return {
		track(result: UploadResult): void {
			pending.set(result.objectKey, result.deleteToken);
		},
		async commit(finalObjectKey: string | null): Promise<void> {
			const toDelete = [...pending.entries()].filter(([key]) => key !== finalObjectKey);
			pending.clear();
			await Promise.allSettled(
				toDelete.map(([key, token]) => deleteUploadedObject(key, token)),
			);
		},
		async discardAll(): Promise<void> {
			await this.commit(null);
		},
	};
}

/**
 * Uploads a file with progress tracking using XMLHttpRequest.
 * The token is only sent in proxy mode – presigned R2 URLs carry their
 * authorization in the query string and reject unexpected signed headers.
 */
function uploadWithProgress(
	url: string,
	file: File,
	token: string | null,
	onProgress: (percentage: number) => void,
	signal?: AbortSignal,
): Promise<{ ok: boolean; status: number }> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open('PUT', url);
		xhr.setRequestHeader('Content-Type', file.type);
		if (token !== null) {
			xhr.setRequestHeader('X-Upload-Token', token);
		}

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

		xhr.addEventListener('timeout', () => {
			reject(new Error('Upload timed out'));
		});

		if (signal != null) {
			if (signal.aborted) {
				xhr.abort();
				return;
			}
			signal.addEventListener(
				'abort',
				() => {
					xhr.abort();
				},
				{ once: true },
			);
		}

		xhr.send(file);
	});
}
