/**
 * Presigned R2 PUT URLs (issue #107, REQ-1). Uploads go straight from the
 * browser to R2 so image bytes never flow through (or get buffered by) the
 * SvelteKit Worker.
 *
 * The signature binds the exact object key, HTTP method, Content-Type, and
 * Content-Length (via X-Amz-SignedHeaders), and expires after
 * {@link PRESIGNED_UPLOAD_EXPIRY_SECONDS} – so a leaked URL cannot be reused
 * for a different key, type, size, or after expiry (REQ-7).
 *
 * Requires R2 S3-API credentials. When they are not configured (local dev,
 * tests, or before the secrets are provisioned), callers fall back to the
 * same-origin upload proxy route.
 */
import { AwsClient } from 'aws4fetch';
import { env } from '$env/dynamic/private';

export const PRESIGNED_UPLOAD_EXPIRY_SECONDS = 600;

interface PresignConfig {
	accountId: string;
	bucketName: string;
	accessKeyId: string;
	secretAccessKey: string;
}

function getPresignConfig(): PresignConfig | null {
	const accountId = env.R2_ACCOUNT_ID;
	const bucketName = env.R2_BUCKET_NAME;
	const accessKeyId = env.R2_ACCESS_KEY_ID;
	const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
	if (
		accountId == null ||
		accountId === '' ||
		bucketName == null ||
		bucketName === '' ||
		accessKeyId == null ||
		accessKeyId === '' ||
		secretAccessKey == null ||
		secretAccessKey === ''
	) {
		return null;
	}
	return { accountId, bucketName, accessKeyId, secretAccessKey };
}

/** Whether direct-to-R2 presigned uploads are configured for this deployment. */
export function isPresignConfigured(): boolean {
	return getPresignConfig() !== null;
}

export interface PresignUploadInput {
	objectKey: string;
	contentType: string;
	contentLength: number;
}

/**
 * Generates a short-lived presigned PUT URL for a direct browser upload to R2.
 * Returns null when R2 S3 credentials are not configured.
 */
export async function presignUploadUrl(input: PresignUploadInput): Promise<string | null> {
	const config = getPresignConfig();
	if (config === null) {
		return null;
	}

	const client = new AwsClient({
		service: 's3',
		region: 'auto',
		accessKeyId: config.accessKeyId,
		secretAccessKey: config.secretAccessKey,
	});

	const endpoint = `https://${config.accountId}.r2.cloudflarestorage.com`;
	const url = new URL(`${endpoint}/${config.bucketName}/${input.objectKey}`);
	url.searchParams.set('X-Amz-Expires', String(PRESIGNED_UPLOAD_EXPIRY_SECONDS));

	const signed = await client.sign(
		new Request(url, {
			method: 'PUT',
			headers: {
				'Content-Type': input.contentType,
				'Content-Length': String(input.contentLength),
			},
		}),
		// signQuery puts the signature in the URL; allHeaders forces Content-Type
		// and Content-Length into X-Amz-SignedHeaders so R2 rejects any upload
		// that does not send exactly the authorized values.
		{ aws: { signQuery: true, allHeaders: true } },
	);

	return signed.url;
}
