import { describe, expect, it } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { giftIngestionItem, giftIngestionRun } from './ingestion.schema.js';

describe('gift ingestion audit schema', () => {
	it('defines additive durable run and item idempotency records with unique stable identities', () => {
		const run = getTableConfig(giftIngestionRun);
		const item = getTableConfig(giftIngestionItem);
		expect(run.columns.map((column) => column.name)).toEqual(
			expect.arrayContaining([
				'manifest_id',
				'wishlist_id',
				'manifest_hash',
				'status',
				'result',
				'started_at',
				'completed_at',
			]),
		);
		expect(item.columns.map((column) => column.name)).toEqual(
			expect.arrayContaining([
				'run_id',
				'item_id',
				'source_url',
				'item_hash',
				'provenance',
				'created_gift_id',
			]),
		);
		const runManifestIndex = run.indexes.find(
			(index) => index.config.name === 'gift_ingestion_run_manifest_unique',
		);
		const itemIdIndex = item.indexes.find(
			(index) => index.config.name === 'gift_ingestion_item_item_unique',
		);
		const columnNames = (columns: readonly object[] | undefined) =>
			columns?.map((column) => ('name' in column ? column.name : undefined));
		expect(runManifestIndex?.config.unique).toBe(true);
		expect(columnNames(runManifestIndex?.config.columns)).toEqual(['manifest_id']);
		expect(itemIdIndex?.config.unique).toBe(true);
		expect(columnNames(itemIdIndex?.config.columns)).toEqual(['item_id']);
	});
});
