import type { UploadTarget, AllowedContentType } from '$lib/server/storage/r2.js';

/** Parameters for requesting an upload. */
export interface UploadRequest {
	target: UploadTarget;
	fileName: string;
	contentType: AllowedContentType;
	fileSize: number;
}

/** Response from the upload authorization command. */
export interface UploadAuthorization {
	/** The object key where the file will be stored. */
	objectKey: string;
	/** Upload endpoint URL (the API route that proxies to R2). */
	uploadUrl: string;
	/** Public URL to access the uploaded file after upload completes. */
	publicUrl: string;
}

/** Result of a completed upload. */
export interface UploadResult {
	/** The R2 object key for storing in the database. */
	objectKey: string;
	/** Public URL to access the uploaded file. */
	publicUrl: string;
}

/** Upload progress state. */
export interface UploadProgress {
	/** Upload phase. */
	status: 'idle' | 'authorizing' | 'uploading' | 'complete' | 'error';
	/** 0-100 percentage. */
	percentage: number;
	/** Error message when status is 'error'. */
	errorMessage?: string;
}
