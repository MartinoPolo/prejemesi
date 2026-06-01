import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Mock the server command module ──────────────────────────────────────────
const mockAuthorizeUpload = vi.fn();

vi.mock('./uploads.remote.js', () => ({
	authorizeUpload: (...args: unknown[]) => mockAuthorizeUpload(...args),
}));

// ── Mock XMLHttpRequest ─────────────────────────────────────────────────────
interface MockXhrInstance {
	open: ReturnType<typeof vi.fn>;
	send: ReturnType<typeof vi.fn>;
	setRequestHeader: ReturnType<typeof vi.fn>;
	status: number;
	upload: {
		addEventListener: ReturnType<typeof vi.fn>;
	};
	addEventListener: ReturnType<typeof vi.fn>;
	_listeners: Record<string, (event?: unknown) => void>;
	_uploadListeners: Record<string, (event?: unknown) => void>;
	_triggerLoad: (status: number) => void;
	_triggerError: () => void;
	_triggerUploadProgress: (loaded: number, total: number) => void;
}

let currentMockXhr: MockXhrInstance;

class MockXMLHttpRequest {
	open = vi.fn();
	send = vi.fn();
	setRequestHeader = vi.fn();
	status = 0;
	_listeners: Record<string, (event?: unknown) => void> = {};
	_uploadListeners: Record<string, (event?: unknown) => void> = {};
	upload = {
		addEventListener: vi.fn((event: string, handler: (event?: unknown) => void) => {
			this._uploadListeners[event] = handler;
		}),
	};

	addEventListener = vi.fn((event: string, handler: (event?: unknown) => void) => {
		this._listeners[event] = handler;
	});

	_triggerLoad(status: number) {
		this.status = status;
		this._listeners['load']?.();
	}

	_triggerError() {
		this._listeners['error']?.();
	}

	_triggerUploadProgress(loaded: number, total: number) {
		this._uploadListeners['progress']?.({ lengthComputable: true, loaded, total });
	}

	constructor() {
		currentMockXhr = this as unknown as MockXhrInstance;
	}
}

vi.stubGlobal('XMLHttpRequest', MockXMLHttpRequest);

import { uploadFile } from './upload.js';
import type { UploadProgress } from './types.js';

function makeFile(name: string, type: string, size = 1024): File {
	// Create a minimal File-like object. In Node environment, File may not be available,
	// so we construct one from Blob.
	const content = new Uint8Array(size);
	const file = new File([content], name, { type });
	return file;
}

const defaultAuthorization = {
	objectKey: 'gifts/abc123.jpg',
	uploadUrl: '/api/upload/gifts/abc123.jpg',
	publicUrl: 'https://cdn.example.com/gifts/abc123.jpg',
};

beforeEach(() => {
	vi.clearAllMocks();
	mockAuthorizeUpload.mockResolvedValue(defaultAuthorization);
});

describe('uploadFile', () => {
	// ── Content type validation ──────────────────────────────────────────────

	describe('content type validation', () => {
		it.each(['application/pdf', 'text/html', 'image/svg+xml', 'video/mp4'])(
			'rejects %s before calling server',
			async (contentType) => {
				const file = makeFile('file', contentType);

				await expect(uploadFile(file, 'gift-image')).rejects.toThrow('Invalid file type');
				expect(mockAuthorizeUpload).not.toHaveBeenCalled();
			},
		);

		it.each(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])(
			'accepts %s and calls server',
			async (contentType) => {
				const file = makeFile(`file.${contentType.split('/')[1]}`, contentType);

				// Trigger successful XHR response after send
				mockAuthorizeUpload.mockResolvedValue(defaultAuthorization);

				const promise = uploadFile(file, 'gift-image');

				// Wait for the XHR to be created and sent
				await vi.waitFor(() => {
					expect(currentMockXhr.send).toHaveBeenCalled();
				});

				currentMockXhr._triggerLoad(200);

				await promise;
				expect(mockAuthorizeUpload).toHaveBeenCalled();
			},
		);
	});

	// ── Progress reporting ───────────────────────────────────────────────────

	describe('progress reporting', () => {
		it('reports authorizing -> uploading -> complete sequence', async () => {
			const progressUpdates: UploadProgress[] = [];
			const onProgress = (progress: UploadProgress) => {
				progressUpdates.push({ ...progress });
			};

			const file = makeFile('photo.jpg', 'image/jpeg');
			const promise = uploadFile(file, 'gift-image', onProgress);

			await vi.waitFor(() => {
				expect(currentMockXhr.send).toHaveBeenCalled();
			});

			// Simulate upload progress
			currentMockXhr._triggerUploadProgress(500, 1024);
			currentMockXhr._triggerLoad(200);

			await promise;

			const statuses = progressUpdates.map((p) => p.status);
			expect(statuses).toContain('authorizing');
			expect(statuses).toContain('uploading');
			expect(statuses).toContain('complete');

			// Verify ordering: authorizing before uploading before complete
			const authIndex = statuses.indexOf('authorizing');
			const uploadIndex = statuses.indexOf('uploading');
			const completeIndex = statuses.lastIndexOf('complete');
			expect(authIndex).toBeLessThan(uploadIndex);
			expect(uploadIndex).toBeLessThan(completeIndex);
		});
	});

	// ── Error propagation from server ────────────────────────────────────────

	describe('error propagation', () => {
		it('reports error status and re-throws when authorizeUpload fails', async () => {
			const serverError = new Error('Authorization denied');
			mockAuthorizeUpload.mockRejectedValue(serverError);

			const progressUpdates: UploadProgress[] = [];
			const onProgress = (progress: UploadProgress) => {
				progressUpdates.push({ ...progress });
			};

			const file = makeFile('photo.jpg', 'image/jpeg');

			await expect(uploadFile(file, 'gift-image', onProgress)).rejects.toThrow(
				'Authorization denied',
			);

			const errorUpdate = progressUpdates.find((p) => p.status === 'error');
			expect(errorUpdate).toBeDefined();
			expect(errorUpdate?.errorMessage).toBe('Authorization denied');
		});
	});

	// ── Upload failure (non-2xx) ─────────────────────────────────────────────

	describe('upload failure', () => {
		it('throws error with status when XHR returns non-2xx', async () => {
			const file = makeFile('photo.jpg', 'image/jpeg');

			const promise = uploadFile(file, 'gift-image');

			await vi.waitFor(() => {
				expect(currentMockXhr.send).toHaveBeenCalled();
			});

			currentMockXhr._triggerLoad(413);

			await expect(promise).rejects.toThrow('Upload failed with status 413');
		});
	});

	// ── Network error ────────────────────────────────────────────────────────

	describe('network error', () => {
		it('throws "Network error during upload" when XHR fires error event', async () => {
			const file = makeFile('photo.jpg', 'image/jpeg');

			const promise = uploadFile(file, 'gift-image');

			await vi.waitFor(() => {
				expect(currentMockXhr.send).toHaveBeenCalled();
			});

			currentMockXhr._triggerError();

			await expect(promise).rejects.toThrow('Network error during upload');
		});
	});

	// ── Successful result ────────────────────────────────────────────────────

	describe('successful result', () => {
		it('returns objectKey and publicUrl from authorization', async () => {
			const file = makeFile('photo.jpg', 'image/jpeg');

			const promise = uploadFile(file, 'gift-image');

			await vi.waitFor(() => {
				expect(currentMockXhr.send).toHaveBeenCalled();
			});

			currentMockXhr._triggerLoad(200);

			const result = await promise;
			expect(result).toEqual({
				objectKey: 'gifts/abc123.jpg',
				publicUrl: 'https://cdn.example.com/gifts/abc123.jpg',
			});
		});
	});
});
