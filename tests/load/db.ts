/**
 * Direct database access for the load-test harness: fixture setup/cleanup,
 * statement-count snapshots, and reservation-integrity verification.
 *
 * Never used by the load scenarios themselves (those go through HTTP like real
 * users) — only for isolation (REQ-6) and correctness/statement metrics (REQ-5).
 */

import { readFileSync } from 'node:fs';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import {
	LOADTEST_ID_PREFIX,
	PRODUCTION_GUARD_ENV,
	PRODUCTION_GUARD_VALUE,
	isLocalHostname,
} from './config.js';

export type LoadTestDb = ReturnType<typeof drizzle>;

export interface DbHandle {
	db: LoadTestDb;
	close: () => Promise<void>;
}

/** Minimal .env loader (same approach as seed.ts — avoids a dotenv dependency). */
export function loadDotEnv(): void {
	try {
		const content = readFileSync('.env', 'utf-8');
		for (const line of content.split('\n')) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith('#')) {
				continue;
			}
			const eqIdx = trimmed.indexOf('=');
			if (eqIdx === -1) {
				continue;
			}
			const key = trimmed.slice(0, eqIdx).trim();
			const value = trimmed
				.slice(eqIdx + 1)
				.trim()
				.replace(/^["']|["']$/g, '');
			if (!(key in process.env)) {
				process.env[key] = value;
			}
		}
	} catch {
		/* .env not found – rely on environment */
	}
}

/**
 * Resolves the database URL for fixtures/metrics: LOADTEST_DATABASE_URL wins
 * (e.g. Neon direct URL for an authorized production run), else DATABASE_URL.
 * Returns null when neither is set — DB-dependent features are then skipped.
 */
export function resolveDatabaseUrl(): string | null {
	loadDotEnv();
	return process.env['LOADTEST_DATABASE_URL'] ?? process.env['DATABASE_URL'] ?? null;
}

/** Non-local databases require the same double-explicit authorization as HTTP targets. */
export function assertDatabaseAuthorized(databaseUrl: string): void {
	const hostname = new URL(databaseUrl).hostname;
	if (isLocalHostname(hostname)) {
		return;
	}
	if (process.env[PRODUCTION_GUARD_ENV] !== PRODUCTION_GUARD_VALUE) {
		throw new Error(
			`Database host ${hostname} is not local. Set ${PRODUCTION_GUARD_ENV}=${PRODUCTION_GUARD_VALUE} ` +
				'to authorize fixture/metric access to a shared database. See docs/LOAD_TESTING.md.',
		);
	}
}

export function connectDb(databaseUrl: string): DbHandle {
	const client = postgres(databaseUrl, {
		prepare: false,
		max: 2,
		onnotice: () => undefined,
	});
	return {
		db: drizzle(client),
		close: () => client.end({ timeout: 5 }),
	};
}

// ── Statement counts (REQ-5) ────────────────────────────────────────────────

/**
 * Total statements executed server-side, from pg_stat_statements. Includes all
 * clients of the database, so run load tests against an otherwise idle target
 * for meaningful deltas. Returns null (with reason) when the extension is
 * unavailable (e.g. local Postgres without shared_preload_libraries).
 */
export async function snapshotStatementCount(
	db: LoadTestDb,
): Promise<{ calls: number } | { calls: null; reason: string }> {
	try {
		await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_stat_statements`);
		const rows = await db.execute<{ calls: string }>(
			sql`SELECT COALESCE(SUM(calls), 0)::bigint AS calls FROM pg_stat_statements`,
		);
		return { calls: Number(rows[0]?.calls ?? 0) };
	} catch (error) {
		return {
			calls: null,
			reason: `pg_stat_statements unavailable: ${error instanceof Error ? error.message : String(error)}`,
		};
	}
}

// ── Reservation integrity (REQ-5, AC-4/5/6) ────────────────────────────────

export interface OverReservedGift {
	giftId: string;
	maxQuantity: number;
	reservedQuantity: number;
}

/**
 * Returns loadtest gifts whose active reservations exceed their quantity —
 * must always be empty. Scoped to gifts on loadtest wishlists (covers gifts
 * created during scenarios, whose ids are app-generated).
 */
export async function findOverReservedGifts(db: LoadTestDb): Promise<OverReservedGift[]> {
	const prefixPattern = `${LOADTEST_ID_PREFIX}%`;
	const rows = await db.execute<{
		gift_id: string;
		max_quantity: number;
		reserved_quantity: string;
	}>(sql`
		SELECT
			g.id AS gift_id,
			COALESCE(g.quantity, 1) AS max_quantity,
			COALESCE(SUM(r.quantity), 0)::bigint AS reserved_quantity
		FROM gift g
		LEFT JOIN reservation r ON r.gift_id = g.id AND r.deleted_at IS NULL
		WHERE (g.id LIKE ${prefixPattern} OR g.wishlist_id LIKE ${prefixPattern})
			AND g.quantity IS NOT NULL
		GROUP BY g.id
		HAVING COALESCE(SUM(r.quantity), 0) > COALESCE(g.quantity, 1)
	`);

	return rows.map((row) => ({
		giftId: row.gift_id,
		maxQuantity: Number(row.max_quantity),
		reservedQuantity: Number(row.reserved_quantity),
	}));
}

/** Active reservation count for one gift (contention verification). */
export async function countActiveReservations(db: LoadTestDb, giftId: string): Promise<number> {
	const rows = await db.execute<{ count: string }>(
		sql`SELECT COUNT(*)::bigint AS count FROM reservation WHERE gift_id = ${giftId} AND deleted_at IS NULL`,
	);
	return Number(rows[0]?.count ?? 0);
}

/** Removes reservation rows on loadtest gifts (fresh state between runs). */
export async function resetLoadTestReservations(db: LoadTestDb): Promise<void> {
	const prefixPattern = `${LOADTEST_ID_PREFIX}%`;
	await db.execute(sql`
		DELETE FROM reservation
		WHERE user_id LIKE ${prefixPattern}
			OR gift_id IN (
				SELECT id FROM gift
				WHERE id LIKE ${prefixPattern} OR wishlist_id LIKE ${prefixPattern}
			)
	`);
}
