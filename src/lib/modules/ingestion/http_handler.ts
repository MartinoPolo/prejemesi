import * as v from 'valibot';
import { MAX_INGESTION_MANIFEST_BYTES, GiftIngestionManifestSchema } from './manifest.js';
import type {
	GiftIngestionConfig,
	GiftIngestionResult,
	ImagePreparationInput,
	PreparedImageReference,
} from './ingestion_service.js';
import type { GiftIngestionManifest } from './manifest.js';
import { ingestionErrorStatus, IngestionError } from './ingestion_error.js';
import { SUPPORTED_INGESTION_IMAGE_TYPES } from './image_mirroring.js';

const PreparedReferenceSchema = v.strictObject({
	wishlistId: v.string(),
	manifestId: v.string(),
	itemId: v.string(),
	key: v.string(),
	sha256: v.string(),
	contentType: v.picklist(SUPPORTED_INGESTION_IMAGE_TYPES),
	byteLength: v.pipe(v.number(), v.integer(), v.minValue(1)),
});
const RequestBodySchema = v.union([
	v.strictObject({
		manifest: GiftIngestionManifestSchema,
		apply: v.optional(v.boolean(), false),
		preparedImages: v.optional(v.array(PreparedReferenceSchema), []),
	}),
	v.strictObject({
		action: v.literal('cleanup-images'),
		manifest: GiftIngestionManifestSchema,
		preparedImages: v.array(PreparedReferenceSchema),
	}),
	v.strictObject({
		action: v.literal('prepare-images'),
		manifest: GiftIngestionManifestSchema,
		images: v.array(
			v.strictObject({
				itemId: v.string(),
				sha256: v.string(),
				contentType: v.picklist(SUPPORTED_INGESTION_IMAGE_TYPES),
				byteLength: v.pipe(v.number(), v.integer(), v.minValue(1)),
				width: v.pipe(v.number(), v.integer(), v.minValue(1)),
				height: v.pipe(v.number(), v.integer(), v.minValue(1)),
			}),
		),
	}),
]);

interface HandlerConfig extends GiftIngestionConfig {
	token: string;
}

export interface GiftIngestionRateLimit {
	limit(input: { key: string }): Promise<{ success: boolean }>;
}

interface HandlerDependencies {
	config: HandlerConfig;
	rateLimit?: GiftIngestionRateLimit;
	process: (
		manifest: GiftIngestionManifest,
		options: {
			apply: boolean;
			config: GiftIngestionConfig;
			preparedImages: readonly PreparedImageReference[];
		},
	) => Promise<GiftIngestionResult | Record<string, unknown>>;
	prepare?: (
		manifest: GiftIngestionManifest,
		options: { images: readonly ImagePreparationInput[]; config: GiftIngestionConfig },
	) => Promise<unknown>;
	cleanup?: (
		manifest: GiftIngestionManifest,
		options: { preparedImages: readonly PreparedImageReference[]; config: GiftIngestionConfig },
	) => Promise<void>;
}

async function constantTimeTokenMatches(candidate: string, expected: string): Promise<boolean> {
	const encoder = new TextEncoder();
	const [candidateHash, expectedHash] = await Promise.all([
		crypto.subtle.digest('SHA-256', encoder.encode(candidate)),
		crypto.subtle.digest('SHA-256', encoder.encode(expected)),
	]);
	const left = new Uint8Array(candidateHash);
	const right = new Uint8Array(expectedHash);
	let difference = 0;
	for (let index = 0; index < left.length; index += 1) {
		difference |= left[index]! ^ right[index]!;
	}
	return difference === 0;
}

function response(body: object, status: number): Response {
	return Response.json(body, {
		status,
		headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
	});
}

const GIFT_INGESTION_RATE_LIMIT_KEY = 'gift-ingestion-endpoint';

export function createGiftIngestionHandler(dependencies: HandlerDependencies) {
	return async (
		request: Request,
		runtimeRateLimit?: GiftIngestionRateLimit,
	): Promise<Response> => {
		const { token, targetShortId, actorId } = dependencies.config;
		if (token === '' || targetShortId === '' || actorId === '') {
			return response({ error: 'Not found' }, 404);
		}

		const authorization = request.headers.get('authorization') ?? '';
		const candidate = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
		if (!(await constantTimeTokenMatches(candidate, token))) {
			return response({ error: 'Unauthorized' }, 401);
		}

		try {
			const rateLimitResult = await (runtimeRateLimit ?? dependencies.rateLimit)?.limit({
				key: GIFT_INGESTION_RATE_LIMIT_KEY,
			});
			if (rateLimitResult === undefined) {
				return response(
					{ error: 'Ingestion rate limit unavailable', code: 'rate_limit_unavailable' },
					503,
				);
			}
			if (!rateLimitResult.success) {
				return response({ error: 'Rate limit exceeded', code: 'rate_limit_exceeded' }, 429);
			}
		} catch {
			return response(
				{ error: 'Ingestion rate limit unavailable', code: 'rate_limit_unavailable' },
				503,
			);
		}

		if (request.headers.get('content-type')?.split(';')[0]?.trim() !== 'application/json') {
			return response({ error: 'Content-Type must be application/json' }, 415);
		}
		const contentLength = Number(request.headers.get('content-length') ?? '0');
		if (contentLength > MAX_INGESTION_MANIFEST_BYTES) {
			return response({ error: 'Request body is too large' }, 413);
		}
		let text: string;
		try {
			text = await request.text();
		} catch {
			return response({ error: 'Unable to read request body' }, 400);
		}
		if (new TextEncoder().encode(text).byteLength > MAX_INGESTION_MANIFEST_BYTES) {
			return response({ error: 'Request body is too large' }, 413);
		}
		let parsed: unknown;
		try {
			parsed = JSON.parse(text);
		} catch {
			return response({ error: 'Request body must be valid JSON' }, 400);
		}
		const validated = v.safeParse(RequestBodySchema, parsed);
		if (!validated.success) {
			return response({ error: 'Invalid ingestion request' }, 400);
		}

		try {
			if ('action' in validated.output) {
				if (validated.output.action === 'cleanup-images') {
					if (dependencies.cleanup === undefined) {
						throw new Error('Image cleanup is unavailable');
					}
					await dependencies.cleanup(validated.output.manifest, {
						preparedImages: validated.output.preparedImages,
						config: { targetShortId, actorId },
					});
					return response({ mode: 'cleanup-images', cleaned: true }, 200);
				}
				if (dependencies.prepare === undefined) {
					throw new Error('Image preparation is unavailable');
				}
				const prepared = await dependencies.prepare(validated.output.manifest, {
					images: validated.output.images,
					config: { targetShortId, actorId },
				});
				return response(
					{ mode: 'prepare-images', prepared } as Record<string, unknown>,
					200,
				);
			}
			const result = await dependencies.process(validated.output.manifest, {
				apply: validated.output.apply,
				preparedImages: validated.output.preparedImages,
				config: { targetShortId, actorId },
			});
			return response(result, 200);
		} catch (caught) {
			if (caught instanceof IngestionError) {
				return response(
					{ error: caught.message, code: caught.code },
					ingestionErrorStatus(caught),
				);
			}
			return response({ error: 'Ingestion failed' }, 500);
		}
	};
}
