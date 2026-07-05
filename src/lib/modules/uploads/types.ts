/** Allowed image MIME types – shared between client and server. */
export const ALLOWED_CONTENT_TYPES = [
	'image/jpeg',
	'image/png',
	'image/webp',
	'image/gif',
] as const;

export type AllowedContentType = (typeof ALLOWED_CONTENT_TYPES)[number];

export function isAllowedContentType(value: string): value is AllowedContentType {
	return (ALLOWED_CONTENT_TYPES as readonly string[]).includes(value);
}

/** Base path for the upload API route. */
export const UPLOAD_API_BASE = '/api/upload';

/** Response from the upload authorization command. */
export interface UploadAuthorization {
	/** The object key where the file will be stored. */
	objectKey: string;
	/** Upload endpoint URL (the API route that proxies to R2). */
	uploadUrl: string;
	/** Public URL to access the uploaded file after upload completes. */
	publicUrl: string;
	/** HMAC token authorizing this specific upload. */
	token: string;
	/** Token expiry as Unix millisecond timestamp. */
	expiresAt: number;
}

/** Response from the delete authorization command. */
export interface DeleteAuthorization {
	/** HMAC token authorizing deletion of a specific object. */
	token: string;
	/** Token expiry as Unix millisecond timestamp. */
	expiresAt: number;
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
