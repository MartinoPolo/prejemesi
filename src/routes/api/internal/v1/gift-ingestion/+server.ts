import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types.js';
import { createGiftIngestionHandler } from '$lib/modules/ingestion/http_handler.js';
import { createGiftIngestionPost } from '$lib/modules/ingestion/http_route.js';
import {
	cleanupPreparedGiftIngestionImages,
	prepareGiftIngestionImages,
	processGiftIngestion,
} from '$lib/modules/ingestion/ingestion_service.js';
import { drizzleGiftIngestionStore } from '$lib/modules/ingestion/ingestion_store.js';
import { presignUploadUrl } from '$lib/server/storage/presign.js';
import { deleteObject, getObject } from '$lib/server/storage/r2.js';
import { getDb } from '$lib/server/db/index.js';
import { giftIngestionOrphan } from '$lib/server/db/ingestion.schema.js';
import { validatePreparedImageReference } from '$lib/modules/ingestion/image_mirroring.js';
import { and, eq, isNull } from 'drizzle-orm';
import { gift } from '$lib/server/db/gift.schema.js';

const imageStorage = {
	get: getObject,
	isReferenced: async (key: string) => {
		const [row] = await getDb()
			.select({ id: gift.id })
			.from(gift)
			.where(and(eq(gift.imageKey, key), isNull(gift.deletedAt)))
			.limit(1);
		return row !== undefined;
	},
	remove: deleteObject,
	recordOrphan: async (input: {
		key: string;
		reason: string;
		manifestId: string;
		itemId: string;
	}) => {
		await getDb()
			.insert(giftIngestionOrphan)
			.values({
				objectKey: input.key,
				reason: input.reason.slice(0, 300),
				manifestId: input.manifestId,
				itemId: input.itemId,
			});
	},
};

const handleGiftIngestion = createGiftIngestionHandler({
	config: {
		token: env.GIFT_INGESTION_TOKEN ?? '',
		targetShortId: env.GIFT_INGESTION_TARGET_SHORT_ID ?? '',
		actorId: env.GIFT_INGESTION_ACTOR_ID ?? '',
	},
	process: (manifest, options) =>
		processGiftIngestion(manifest, {
			...options,
			store: drizzleGiftIngestionStore,
			imageStorage,
		}),
	prepare: (manifest, options) =>
		prepareGiftIngestionImages(manifest, {
			...options,
			store: drizzleGiftIngestionStore,
			presign: presignUploadUrl,
		}),
	cleanup: async (manifest, options) => {
		if (manifest.wishlist.shortId !== options.config.targetShortId) {
			throw new Error('Manifest target mismatch');
		}
		const target = await drizzleGiftIngestionStore.resolveTarget(
			undefined,
			options.config.targetShortId,
		);
		if (target === null) {
			throw new Error('Configured ingestion target was not found');
		}
		for (const reference of options.preparedImages) {
			validatePreparedImageReference(reference);
			if (
				reference.wishlistId !== target.id ||
				reference.manifestId !== manifest.manifestId
			) {
				throw new Error('Image cleanup binding mismatch');
			}
		}
		await cleanupPreparedGiftIngestionImages(
			options.preparedImages,
			imageStorage,
			manifest.manifestId,
		);
	},
});

export const POST: RequestHandler = createGiftIngestionPost(handleGiftIngestion);
