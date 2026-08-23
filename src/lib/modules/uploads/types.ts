/** Allowed image MIME types – shared between client and server. */
export const ALLOWED_CONTENT_TYPES = [
	'image/jpeg',
	'image/png',
	'image/webp',
	'image/gif',
] as const;

export type AllowedContentType = (typeof ALLOWED_CONTENT_TYPES)[number];

/** Maximum bytes accepted for a gift image across uploads and ingestion. */
export const MAX_GIFT_IMAGE_BYTES = 5 * 1024 * 1024;

export function isAllowedContentType(value: string): value is AllowedContentType {
	return (ALLOWED_CONTENT_TYPES as readonly string[]).includes(value);
}

/** Base path for the upload API route. */
export const UPLOAD_API_BASE = '/api/upload';

/**
 * How the browser delivers the file bytes. `presigned` PUTs directly to R2
 * (REQ-1); `proxy` PUTs to the same-origin API route (local dev / fallback
 * when R2 S3 credentials are not configured).
 */
export const UPLOAD_MODES = {
	presigned: 'presigned',
	proxy: 'proxy',
} as const;

export type UploadMode = (typeof UPLOAD_MODES)[keyof typeof UPLOAD_MODES];

/** Response from the upload authorization command. */
export interface UploadAuthorization {
	/** The object key where the file will be stored. */
	objectKey: string;
	/** Whether the upload goes directly to R2 or through the proxy route. */
	uploadMode: UploadMode;
	/** Where to PUT the file – a presigned R2 URL or the proxy API route. */
	uploadUrl: string;
	/** HMAC token for the proxy route; null in presigned mode. */
	uploadToken: string | null;
	/** HMAC token authorizing the uploader to delete this one object (cancel/replace cleanup). */
	deleteToken: string;
	/** Public URL to access the uploaded file after upload completes. */
	publicUrl: string;
	/** Upload authorization expiry as Unix millisecond timestamp. */
	expiresAt: number;
}

/** Result of a completed upload. */
export interface UploadResult {
	/** The R2 object key for storing in the database. */
	objectKey: string;
	/** Public URL to access the uploaded file. */
	publicUrl: string;
	/** Token that lets this uploader delete the object if the flow is cancelled. */
	deleteToken: string;
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
