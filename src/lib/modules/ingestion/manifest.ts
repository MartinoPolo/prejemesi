import * as v from 'valibot';
import { MAX_GIFT_LINKS, GIFT_CURRENCY_VALUES } from '$lib/modules/gifts/types.js';
import { MAX_IMPORT_BYTES, MAX_IMPORT_ROWS } from '$lib/modules/import/import_limits.js';

const GIFT_INGESTION_SCHEMA_VERSION = 1 as const;
export const MAX_INGESTION_MANIFEST_BYTES = MAX_IMPORT_BYTES;
const MAX_INGESTION_ITEMS = MAX_IMPORT_ROWS;

const StableIdSchema = v.pipe(
	v.string(),
	v.minLength(1),
	v.maxLength(128),
	v.regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/),
);
const NonBlankTextSchema = v.pipe(v.string(), v.trim(), v.minLength(1));
const HttpsUrlSchema = v.pipe(
	v.string(),
	v.url(),
	v.check((url) => url.startsWith('https://'), 'URL must use HTTPS'),
);
const GiftLinkSchema = v.strictObject({
	url: HttpsUrlSchema,
	label: v.optional(v.pipe(v.string(), v.maxLength(200))),
});
const ProvenanceSourceSchema = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(100));
const GiftIngestionAmbiguitySchema = v.strictObject({
	itemId: v.optional(StableIdSchema),
	field: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(100)),
	reason: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(300)),
});

const GiftIngestionItemSchema = v.pipe(
	v.strictObject({
		itemId: StableIdSchema,
		sourceUrl: HttpsUrlSchema,
		gift: v.pipe(
			v.strictObject({
				name: NonBlankTextSchema,
				description: v.optional(v.nullable(v.pipe(v.string(), v.maxLength(10_000)))),
				links: v.pipe(v.array(GiftLinkSchema), v.minLength(1), v.maxLength(MAX_GIFT_LINKS)),
				price: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0)))),
				priceMax: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0)))),
				currency: v.picklist(GIFT_CURRENCY_VALUES),
				imageUrl: v.optional(v.nullable(HttpsUrlSchema)),
				quantity: v.pipe(v.number(), v.integer(), v.minValue(1)),
				priority: v.picklist(['high', 'medium']),
			}),
			v.check(
				(gift) =>
					gift.price == null || gift.priceMax == null || gift.priceMax >= gift.price,
				'priceMax must be greater than or equal to price',
			),
		),
		provenance: v.strictObject({
			gatheredAt: v.pipe(v.string(), v.isoTimestamp()),
			fields: v.record(v.string(), ProvenanceSourceSchema),
			imageSource: v.optional(
				v.strictObject({
					url: HttpsUrlSchema,
					method: ProvenanceSourceSchema,
				}),
			),
		}),
	}),
	v.check(
		(item) => item.gift.links[0]?.url === item.sourceUrl,
		'Primary gift link must equal sourceUrl',
	),
);

export const GiftIngestionManifestSchema = v.pipe(
	v.strictObject({
		schemaVersion: v.literal(GIFT_INGESTION_SCHEMA_VERSION),
		manifestId: StableIdSchema,
		wishlist: v.strictObject({
			shortId: StableIdSchema,
			title: NonBlankTextSchema,
			recipient: NonBlankTextSchema,
		}),
		items: v.pipe(v.array(GiftIngestionItemSchema), v.maxLength(MAX_INGESTION_ITEMS)),
		ambiguities: v.optional(v.pipe(v.array(GiftIngestionAmbiguitySchema), v.maxLength(50))),
	}),
	v.check(
		(manifest) =>
			new Set(manifest.items.map((item) => item.itemId)).size === manifest.items.length,
		'Item IDs must be unique',
	),
);

export type GiftIngestionManifest = v.InferOutput<typeof GiftIngestionManifestSchema>;
export type GiftIngestionItem = v.InferOutput<typeof GiftIngestionItemSchema>;

export function parseGiftIngestionManifest(input: string): GiftIngestionManifest {
	if (new TextEncoder().encode(input).byteLength > MAX_INGESTION_MANIFEST_BYTES) {
		throw new Error('Ingestion manifest is too large');
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(input);
	} catch {
		throw new Error('Ingestion manifest must be valid JSON');
	}
	return v.parse(GiftIngestionManifestSchema, parsed);
}
