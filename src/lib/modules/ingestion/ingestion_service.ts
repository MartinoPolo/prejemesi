import { canonicalIngestionSourceKey } from '$lib/modules/gifts/gift_url.js';
import type {
	GiftCreationTransaction,
	NormalizedGiftCreationInput,
} from '$lib/modules/gifts/gift_creation_service.js';
import type { GiftIngestionItem, GiftIngestionManifest } from './manifest.js';
import {
	imageObjectKey,
	validatePreparedImageReference,
	type IngestionImageContentType,
	type PreparedImageBinding,
} from './image_mirroring.js';
import type { PresignUploadInput } from '$lib/server/storage/presign.js';
import { IngestionError } from './ingestion_error.js';

export interface IngestionTarget {
	id: string;
	shortId: string;
	title: string;
	recipient: string;
	status: string;
}

export interface StoredIngestionItem {
	itemId: string;
	itemHash: string;
	createdGiftId: string | null;
}

export interface GiftIngestionStore {
	transaction<T>(work: (tx: GiftCreationTransaction) => Promise<T>): Promise<T>;
	lockTarget(tx: GiftCreationTransaction, wishlistId: string): Promise<void>;
	resolveTarget(
		tx: GiftCreationTransaction | undefined,
		fixedShortId: string,
	): Promise<IngestionTarget | null>;
	findRun(
		tx: GiftCreationTransaction | undefined,
		manifestId: string,
	): Promise<{ manifestHash: string; result?: Record<string, unknown> } | null>;
	findItems(
		tx: GiftCreationTransaction | undefined,
		itemIds: readonly string[],
	): Promise<StoredIngestionItem[]>;
	findExistingSourceKeys(
		tx: GiftCreationTransaction | undefined,
		wishlistId: string,
	): Promise<Set<string>>;
	resolvePriorities(
		tx: GiftCreationTransaction | undefined,
		wishlistId: string,
	): Promise<{ high: string | null; medium: string | null }>;
	resolveCategoryLabels?(
		tx: GiftCreationTransaction | undefined,
		wishlistId: string,
		labels: readonly string[],
	): Promise<Map<string, string>>;
	appendGifts(
		tx: GiftCreationTransaction,
		input: {
			wishlistId: string;
			actorId: string;
			gifts: readonly NormalizedGiftCreationInput[];
		},
	): Promise<{ id: string }[]>;
	insertRun(
		tx: GiftCreationTransaction,
		input: {
			manifestId: string;
			wishlistId: string;
			manifestHash: string;
			status: 'applied';
			result: Record<string, unknown>;
		},
	): Promise<string>;
	insertItems(
		tx: GiftCreationTransaction,
		runId: string,
		items: readonly {
			itemId: string;
			sourceUrl: string;
			itemHash: string;
			createdGiftId: string | null;
			provenance: GiftIngestionItem['provenance'];
		}[],
	): Promise<void>;
}

export interface GiftIngestionConfig {
	targetShortId: string;
	actorId: string;
}

export interface PreparedImageReference extends PreparedImageBinding {
	itemId: string;
	key: string;
}

export interface IngestionImageStorage {
	get(key: string): Promise<{ body: ArrayBuffer; contentType: string } | null>;
	isReferenced(key: string): Promise<boolean>;
	remove(key: string): Promise<void>;
	recordOrphan(input: {
		key: string;
		reason: string;
		manifestId: string;
		itemId: string;
	}): Promise<void>;
}

export interface ImagePreparationInput {
	itemId: string;
	sha256: string;
	contentType: IngestionImageContentType;
	byteLength: number;
	width: number;
	height: number;
}

interface PlannedItem {
	item: GiftIngestionItem;
	hash: string;
	categoryId: string | null;
}

const MAX_INGESTION_WARNINGS = 50;
const MAX_INGESTION_WARNING_LENGTH = 300;

export class IngestionWarningCollector {
	readonly #warnings: string[] = [];

	add(message: string): void {
		if (this.#warnings.length < MAX_INGESTION_WARNINGS) {
			this.#warnings.push(message.slice(0, MAX_INGESTION_WARNING_LENGTH));
		}
	}

	values(): string[] {
		return [...this.#warnings];
	}
}

function collectManifestWarnings(manifest: GiftIngestionManifest): string[] {
	const collector = new IngestionWarningCollector();
	for (const item of manifest.items) {
		const expectedMetadataFields = [
			'name',
			...(item.gift.description == null ? [] : ['description']),
			...(item.gift.price == null ? [] : ['price']),
			...(item.gift.priceMax == null ? [] : ['priceMax']),
		];
		const missing = expectedMetadataFields.filter(
			(field) => item.provenance.fields[field] === undefined,
		);
		if (missing.length > 0) {
			collector.add(
				`Item ${item.itemId}: add metadata provenance for ${missing.join(', ')}.`,
			);
		}

		const giftImageUrl = item.gift.imageUrl ?? null;
		const provenanceImageUrl = item.provenance.imageSource?.url ?? null;
		if (giftImageUrl !== null && provenanceImageUrl === null) {
			collector.add(
				`Item ${item.itemId}: image URL is present but image provenance is missing.`,
			);
		} else if (giftImageUrl === null && provenanceImageUrl !== null) {
			collector.add(
				`Item ${item.itemId}: image provenance is present but the gift image URL is missing.`,
			);
		} else if (giftImageUrl !== null && provenanceImageUrl !== giftImageUrl) {
			collector.add(
				`Item ${item.itemId}: gift image URL differs from its image provenance URL.`,
			);
		}
	}
	return collector.values();
}

export interface GiftIngestionResult {
	mode: 'dry-run' | 'apply';
	target: Omit<IngestionTarget, 'id' | 'status'>;
	wouldCreate: { itemId: string; name: string }[];
	alreadyApplied: { itemId: string; giftId: string }[];
	skipped: { itemId: string; reason: 'existing-source-url' }[];
	warnings: string[];
	ambiguities: NonNullable<GiftIngestionManifest['ambiguities']>;
	conflicts: (
		| { itemId: string; reason: 'item-content-changed' }
		| { manifestId: string; reason: 'manifest-content-changed' }
	)[];
	created: { itemId: string; giftId: string }[];
}

function canonicalJson(value: unknown): string {
	if (Array.isArray(value)) {
		return `[${value.map(canonicalJson).join(',')}]`;
	}
	if (value !== null && typeof value === 'object') {
		return `{${Object.entries(value as Record<string, unknown>)
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
			.join(',')}}`;
	}
	return JSON.stringify(value);
}

async function hash(value: unknown): Promise<string> {
	const bytes = new TextEncoder().encode(canonicalJson(value));
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function canonicalGiftIngestionItemHash(item: GiftIngestionItem): Promise<string> {
	return hash(item);
}

function assertTarget(manifest: GiftIngestionManifest, config: GiftIngestionConfig): void {
	if (manifest.wishlist.shortId !== config.targetShortId) {
		throw new IngestionError(
			'target_mismatch',
			'Manifest target does not match the configured fixed target',
		);
	}
}

function storedAppliedEntries(value: unknown): { itemId: string; giftId: string }[] {
	return Array.isArray(value)
		? value.filter(
				(entry): entry is { itemId: string; giftId: string } =>
					typeof entry === 'object' &&
					entry !== null &&
					typeof (entry as Record<string, unknown>).itemId === 'string' &&
					typeof (entry as Record<string, unknown>).giftId === 'string',
			)
		: [];
}

function storedWarnings(value: unknown): string[] {
	return Array.isArray(value)
		? value
				.filter((warning): warning is string => typeof warning === 'string')
				.slice(0, MAX_INGESTION_WARNINGS)
				.map((warning) => warning.slice(0, MAX_INGESTION_WARNING_LENGTH))
		: [];
}

function storedReplayResult(
	stored: Record<string, unknown> | undefined,
	base: Pick<GiftIngestionResult, 'target' | 'ambiguities'>,
): GiftIngestionResult {
	const appliedByItemId = new Map<string, { itemId: string; giftId: string }>();
	for (const entry of [
		...storedAppliedEntries(stored?.alreadyApplied),
		...storedAppliedEntries(stored?.created),
	]) {
		if (!appliedByItemId.has(entry.itemId)) {
			appliedByItemId.set(entry.itemId, entry);
		}
	}
	const skipped = Array.isArray(stored?.skipped)
		? stored.skipped.filter(
				(entry): entry is { itemId: string; reason: 'existing-source-url' } =>
					typeof entry === 'object' &&
					entry !== null &&
					typeof (entry as Record<string, unknown>).itemId === 'string' &&
					(entry as Record<string, unknown>).reason === 'existing-source-url',
			)
		: [];
	return {
		mode: 'dry-run',
		target: base.target,
		wouldCreate: [],
		alreadyApplied: [...appliedByItemId.values()],
		skipped,
		warnings: storedWarnings(stored?.warnings),
		ambiguities: base.ambiguities,
		conflicts: [],
		created: [],
	};
}

async function plan(
	tx: GiftCreationTransaction | undefined,
	manifest: GiftIngestionManifest,
	config: GiftIngestionConfig,
	store: GiftIngestionStore,
): Promise<{
	result: GiftIngestionResult;
	creatable: PlannedItem[];
	sourceSkipped: PlannedItem[];
	priorities: { high: string | null; medium: string | null };
	manifestHash: string;
	targetId: string;
}> {
	const target = await store.resolveTarget(tx, config.targetShortId);
	if (target === null) {
		throw new IngestionError('target_not_found', 'Configured ingestion target was not found');
	}
	if (target.status === 'archived') {
		throw new IngestionError('target_archived', 'Configured ingestion target is archived');
	}
	if (
		target.shortId !== manifest.wishlist.shortId ||
		target.title !== manifest.wishlist.title ||
		target.recipient !== manifest.wishlist.recipient
	) {
		throw new IngestionError(
			'target_mismatch',
			'Manifest wishlist identity does not exactly match the configured target',
		);
	}

	const manifestHash = await hash(manifest);
	const priorRun = await store.findRun(tx, manifest.manifestId);
	const targetResult = {
		shortId: target.shortId,
		title: target.title,
		recipient: target.recipient,
	};
	if (priorRun !== null && priorRun.manifestHash === manifestHash) {
		const priorities = await store.resolvePriorities(tx, target.id);
		return {
			result: storedReplayResult(priorRun.result, {
				target: targetResult,
				ambiguities: manifest.ambiguities ?? [],
			}),
			creatable: [],
			sourceSkipped: [],
			priorities,
			manifestHash,
			targetId: target.id,
		};
	}
	const itemHashes = await Promise.all(manifest.items.map(canonicalGiftIngestionItemHash));
	const requestedCategoryLabels = manifest.items
		.map((item) => item.gift.category ?? null)
		.filter((label): label is string => label !== null);
	const resolvedCategoryIds =
		store.resolveCategoryLabels === undefined
			? new Map<string, string>()
			: await store.resolveCategoryLabels(tx, target.id, requestedCategoryLabels);
	const planned = manifest.items.map((item, index) => {
		const categoryLabel = item.gift.category ?? null;
		const categoryId =
			categoryLabel === null ? null : (resolvedCategoryIds.get(categoryLabel) ?? null);
		if (categoryLabel !== null && categoryId === null) {
			throw new IngestionError(
				'category_unknown',
				`Category is not enabled for item ${item.itemId}`,
			);
		}
		return { item, hash: itemHashes[index]!, categoryId };
	});
	const priorItems = await store.findItems(
		tx,
		planned.map(({ item }) => item.itemId),
	);
	const priorById = new Map(priorItems.map((item) => [item.itemId, item]));
	const existingSources = await store.findExistingSourceKeys(tx, target.id);
	const alreadyApplied: GiftIngestionResult['alreadyApplied'] = [];
	const skipped: GiftIngestionResult['skipped'] = [];
	const conflicts: GiftIngestionResult['conflicts'] = [];
	const creatable: PlannedItem[] = [];
	const sourceSkipped: PlannedItem[] = [];
	if (priorRun !== null && priorRun.manifestHash !== manifestHash) {
		conflicts.push({
			manifestId: manifest.manifestId,
			reason: 'manifest-content-changed',
		});
	}

	for (const candidate of planned) {
		const prior = priorById.get(candidate.item.itemId);
		if (prior !== undefined) {
			if (prior.itemHash !== candidate.hash) {
				conflicts.push({ itemId: candidate.item.itemId, reason: 'item-content-changed' });
			} else if (prior.createdGiftId === null) {
				skipped.push({ itemId: candidate.item.itemId, reason: 'existing-source-url' });
			} else {
				alreadyApplied.push({ itemId: candidate.item.itemId, giftId: prior.createdGiftId });
			}
			continue;
		}
		const sourceKey = canonicalIngestionSourceKey(candidate.item.sourceUrl);
		if (sourceKey !== null && existingSources.has(sourceKey)) {
			skipped.push({ itemId: candidate.item.itemId, reason: 'existing-source-url' });
			sourceSkipped.push(candidate);
			continue;
		}
		creatable.push(candidate);
		if (sourceKey !== null) {
			existingSources.add(sourceKey);
		}
	}

	const priorities = await store.resolvePriorities(tx, target.id);
	return {
		result: {
			mode: 'dry-run',
			target: targetResult,
			wouldCreate: creatable.map(({ item }) => ({
				itemId: item.itemId,
				name: item.gift.name,
			})),
			alreadyApplied,
			skipped,
			warnings: collectManifestWarnings(manifest),
			ambiguities: manifest.ambiguities ?? [],
			conflicts,
			created: [],
		},
		creatable,
		sourceSkipped,
		priorities,
		manifestHash,
		targetId: target.id,
	};
}

export async function prepareGiftIngestionImages(
	manifest: GiftIngestionManifest,
	options: {
		config: GiftIngestionConfig;
		store: GiftIngestionStore;
		images: readonly ImagePreparationInput[];
		presign(input: PresignUploadInput): Promise<string | null>;
	},
): Promise<(PreparedImageReference & { uploadUrl: string })[]> {
	assertTarget(manifest, options.config);
	if ((manifest.ambiguities?.length ?? 0) > 0) {
		throw new IngestionError('ambiguity', 'Manifest contains unresolved ambiguities');
	}
	const planned = await plan(undefined, manifest, options.config, options.store);
	const creatableIds = new Set(planned.creatable.map(({ item }) => item.itemId));
	if (new Set(options.images.map(({ itemId }) => itemId)).size !== options.images.length) {
		throw new Error('Duplicate image preparation item');
	}
	const output: (PreparedImageReference & { uploadUrl: string })[] = [];
	for (const image of options.images) {
		const item = manifest.items.find(({ itemId }) => itemId === image.itemId);
		if (item === undefined || !creatableIds.has(image.itemId) || item.gift.imageUrl == null) {
			throw new Error('Image preparation item is not a validated creatable manifest item');
		}
		if (image.width <= 0 || image.height <= 0) {
			throw new Error('Image dimensions must be positive');
		}
		const binding = {
			wishlistId: planned.targetId,
			manifestId: manifest.manifestId,
			itemId: image.itemId,
			sha256: image.sha256,
			contentType: image.contentType,
			byteLength: image.byteLength,
		};
		const key = imageObjectKey(binding);
		validatePreparedImageReference({ ...binding, key });
		const uploadUrl = await options.presign({
			objectKey: key,
			contentType: image.contentType,
			contentLength: image.byteLength,
		});
		if (uploadUrl === null) {
			throw new Error('Direct R2 image upload is not configured');
		}
		output.push({ ...binding, key, uploadUrl });
	}
	return output;
}

export async function cleanupPreparedGiftIngestionImages(
	references: readonly PreparedImageReference[],
	storage: IngestionImageStorage,
	manifestId: string,
): Promise<void> {
	for (const reference of references) {
		try {
			if (await storage.isReferenced(reference.key)) {
				continue;
			}
		} catch (caught) {
			const detail = caught instanceof Error ? caught.message : 'unknown verification error';
			const reason = `Reference verification failed: ${detail}`.slice(0, 300);
			try {
				await storage.recordOrphan({
					key: reference.key,
					reason,
					manifestId,
					itemId: reference.itemId,
				});
			} catch {
				/* bounded report is best effort */
			}
			continue;
		}
		try {
			await storage.remove(reference.key);
		} catch (caught) {
			const reason = (caught instanceof Error ? caught.message : 'cleanup failed').slice(
				0,
				300,
			);
			try {
				await storage.recordOrphan({
					key: reference.key,
					reason,
					manifestId,
					itemId: reference.itemId,
				});
			} catch {
				/* bounded report is best effort */
			}
		}
	}
}

export async function processGiftIngestion(
	manifest: GiftIngestionManifest,
	options: {
		apply: boolean;
		config: GiftIngestionConfig;
		store: GiftIngestionStore;
		preparedImages?: readonly PreparedImageReference[];
		imageStorage?: IngestionImageStorage;
	},
): Promise<GiftIngestionResult> {
	assertTarget(manifest, options.config);
	if (!options.apply) {
		return (await plan(undefined, manifest, options.config, options.store)).result;
	}
	if ((manifest.ambiguities?.length ?? 0) > 0) {
		throw new IngestionError('ambiguity', 'Manifest contains unresolved ambiguities');
	}

	const initial = await plan(undefined, manifest, options.config, options.store);
	const references = options.preparedImages ?? [];
	const expectedImageItems = initial.creatable.filter(({ item }) => item.gift.imageUrl != null);
	const expectedImageIds = new Set(expectedImageItems.map(({ item }) => item.itemId));
	if (
		new Set(references.map(({ itemId }) => itemId)).size !== references.length ||
		references.some(({ itemId }) => !expectedImageIds.has(itemId))
	) {
		throw new Error('Prepared image references do not match requested creatable images');
	}
	const byItem = new Map(references.map((reference) => [reference.itemId, reference]));
	if (expectedImageItems.length > 0 && options.imageStorage === undefined) {
		throw new Error('Prepared image storage verification is required');
	}
	try {
		for (const { item } of expectedImageItems) {
			const reference = byItem.get(item.itemId);
			if (reference === undefined) {
				throw new Error(`Image verification failed for ${item.itemId}: no prepared upload`);
			}
			validatePreparedImageReference(reference);
			if (
				reference.wishlistId !== initial.targetId ||
				reference.manifestId !== manifest.manifestId
			) {
				throw new Error(
					`Image verification failed for ${item.itemId}: target binding mismatch`,
				);
			}
			const object = await options.imageStorage!.get(reference.key);
			if (
				object === null ||
				object.body.byteLength !== reference.byteLength ||
				object.contentType !== reference.contentType
			) {
				throw new Error(
					`Image verification failed for ${item.itemId}: stored object metadata mismatch`,
				);
			}
			const digest = await crypto.subtle.digest('SHA-256', object.body);
			const sha256 = [...new Uint8Array(digest)]
				.map((byte) => byte.toString(16).padStart(2, '0'))
				.join('');
			if (sha256 !== reference.sha256.toLowerCase()) {
				throw new Error(
					`Image verification failed for ${item.itemId}: stored object digest mismatch`,
				);
			}
		}
	} catch (caught) {
		if (options.imageStorage !== undefined) {
			await cleanupPreparedGiftIngestionImages(
				references,
				options.imageStorage,
				manifest.manifestId,
			);
		}
		throw caught;
	}

	try {
		const result = await options.store.transaction(async (tx) => {
			await options.store.lockTarget(tx, initial.targetId);
			const planned = await plan(tx, manifest, options.config, options.store);
			const priorRun = await options.store.findRun(tx, manifest.manifestId);
			if (planned.result.conflicts.length > 0) {
				throw new IngestionError('idempotency_conflict', 'Ingestion idempotency conflict');
			}
			if (priorRun !== null) {
				return { ...planned.result, mode: 'apply' as const };
			}
			const missingPreparedImage = planned.creatable.find(
				({ item }) => item.gift.imageUrl != null && !byItem.has(item.itemId),
			);
			if (missingPreparedImage !== undefined) {
				throw new Error(
					`Image verification failed for ${missingPreparedImage.item.itemId}: no prepared upload after replanning`,
				);
			}

			const createdRows =
				planned.creatable.length === 0
					? []
					: await options.store.appendGifts(tx, {
							wishlistId: planned.targetId,
							actorId: options.config.actorId,
							gifts: planned.creatable.map(({ item, categoryId }) => ({
								...item.gift,
								imageUrl: byItem.has(item.itemId) ? null : item.gift.imageUrl,
								imageKey: byItem.get(item.itemId)?.key ?? null,
								priorityLevelId: planned.priorities[item.gift.priority],
								categoryId,
							})),
						});
			const created = planned.creatable.map(({ item }, index) => ({
				itemId: item.itemId,
				giftId: createdRows[index]!.id,
			}));
			const persistedResult = {
				alreadyApplied: planned.result.alreadyApplied,
				created,
				skipped: planned.result.skipped,
				warnings: planned.result.warnings,
				ambiguities: planned.result.ambiguities,
			};
			const runId = await options.store.insertRun(tx, {
				manifestId: manifest.manifestId,
				wishlistId: planned.targetId,
				manifestHash: planned.manifestHash,
				status: 'applied',
				result: persistedResult,
			});
			await options.store.insertItems(tx, runId, [
				...planned.creatable.map(({ item, hash: itemHash }, index) => ({
					itemId: item.itemId,
					sourceUrl: item.sourceUrl,
					itemHash,
					createdGiftId: createdRows[index]!.id,
					provenance: item.provenance,
				})),
				...planned.sourceSkipped.map(({ item, hash: itemHash }) => ({
					itemId: item.itemId,
					sourceUrl: item.sourceUrl,
					itemHash,
					createdGiftId: null,
					provenance: item.provenance,
				})),
			]);
			return { ...planned.result, mode: 'apply' as const, created };
		});
		if (options.imageStorage !== undefined) {
			await cleanupPreparedGiftIngestionImages(
				references,
				options.imageStorage,
				manifest.manifestId,
			);
		}
		return result;
	} catch (caught) {
		if (options.imageStorage !== undefined) {
			await cleanupPreparedGiftIngestionImages(
				references,
				options.imageStorage,
				manifest.manifestId,
			);
		}
		throw caught;
	}
}
