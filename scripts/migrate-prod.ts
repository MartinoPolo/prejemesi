import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import {
	loadMigrationManifest,
	reconcileMigrationHistory,
	type MigrationLedgerRow,
	type MigrationManifestEntry,
	type MigrationReconciliation,
} from './migration-history.js';

const ENV_FILE = '.env.production';
const MIGRATION_LOCK_NAMESPACE = 0x5052454a;
const MIGRATION_LOCK_KEY = 0x454d4553;
const PRODUCTION_DATABASE_TARGET_FINGERPRINT =
	'8cf1aabf5576720ff6c8229f7b2fdf2abaef14c5cff6b3ae83f36e123ce2d185';

export type MigrationOptions = { check: boolean; yes: boolean };

export function parseOptions(args: readonly string[]): MigrationOptions {
	let check = false;
	let yes = false;
	for (const argument of args) {
		if (argument === '--') {
			continue;
		}
		if (argument === '--check') {
			check = true;
		} else if (argument === '--yes') {
			yes = true;
		} else {
			throw new Error(`Unknown option: ${argument}`);
		}
	}
	if (check && yes) {
		throw new Error('--check and --yes cannot be used together');
	}
	return { check, yes };
}

export function productionDatabaseTargetFingerprint(value: string): string {
	const url = new URL(value);
	const identity = `${url.hostname.toLowerCase()}:${url.port || '5432'}${decodeURIComponent(url.pathname)}`;
	return createHash('sha256').update(identity).digest('hex');
}

export function validateProductionDatabaseUrl(
	value: string,
	expectedTargetFingerprint = PRODUCTION_DATABASE_TARGET_FINGERPRINT,
): string {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw new Error('DATABASE_URL must be a valid PostgreSQL URL');
	}
	if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
		throw new Error('DATABASE_URL must be a PostgreSQL URL');
	}
	if (url.hostname.includes('%')) {
		throw new Error('DATABASE_URL must use a direct Neon hostname');
	}
	const hostname = url.hostname.toLowerCase();
	if (hostname.includes(',')) {
		throw new Error('DATABASE_URL must use a direct Neon hostname');
	}
	if (!hostname.endsWith('.neon.tech')) {
		throw new Error('DATABASE_URL must use the production Neon database');
	}
	if (hostname.includes('-pooler')) {
		throw new Error('DATABASE_URL must use a direct Neon hostname, not a pooled hostname');
	}
	const targetOverrideParameters = [
		'host',
		'hostname',
		'port',
		'database',
		'dbname',
		'user',
		'password',
	];
	if (targetOverrideParameters.some((parameter) => url.searchParams.has(parameter))) {
		throw new Error('DATABASE_URL must not override the production database target');
	}
	if (productionDatabaseTargetFingerprint(value) !== expectedTargetFingerprint) {
		throw new Error('DATABASE_URL does not match the pinned production database target');
	}
	return value;
}

function readProductionUrl(): string {
	if (!existsSync(ENV_FILE)) {
		throw new Error(`${ENV_FILE} not found`);
	}
	const variables: Record<string, string> = {};
	for (const line of readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) {
			continue;
		}
		const separator = trimmed.indexOf('=');
		if (separator < 0) {
			continue;
		}
		const key = trimmed.slice(0, separator).trim();
		let value = trimmed.slice(separator + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		variables[key] = value;
	}
	if (!variables.DATABASE_URL) {
		throw new Error(`DATABASE_URL not found in ${ENV_FILE}`);
	}
	return validateProductionDatabaseUrl(variables.DATABASE_URL);
}

async function readLedger(sql: postgres.Sql): Promise<MigrationLedgerRow[]> {
	const [{ ledger }] = await sql<{ ledger: string | null }[]>`
		select to_regclass('drizzle.__drizzle_migrations')::text as ledger
	`;
	if (!ledger) {
		return [];
	}
	const rows = await sql<{ id: string; hash: string; created_at: string }[]>`
		select id, hash, created_at
		from drizzle.__drizzle_migrations
		order by created_at, id
	`;
	return rows.map((row) => ({ id: row.id, hash: row.hash, createdAt: row.created_at }));
}

export function formatState(
	result: MigrationReconciliation,
	manifest: readonly MigrationManifestEntry[],
): string[] {
	const first = manifest[0].tag;
	const latest = manifest.at(-1)?.tag ?? first;
	const lines = [`Manifest: ${manifest.length} migrations (${first} → ${latest})`];
	if (result.status === 'exact') {
		return [...lines, 'EXACT'];
	}
	if (result.status === 'pending') {
		return [
			...lines,
			`PENDING: ${result.pending.map((migration) => migration.tag).join(', ')}`,
		];
	}
	return [...lines, `DRIFT: ${result.diagnostic}`];
}

export interface MigrationLedgerConnection {
	acquireLock(): Promise<void>;
	read(): Promise<MigrationLedgerRow[]>;
	migrate(): Promise<void>;
	releaseLock(): Promise<void>;
	close(): Promise<void>;
}

export interface MigrationRuntime {
	readProductionUrl(): string;
	loadManifest(repositoryRoot: string): Promise<MigrationManifestEntry[]>;
	currentWorkingDirectory(): string;
	openLedger(databaseUrl: string, repositoryRoot: string): MigrationLedgerConnection;
	log(message: string): void;
	error(message: string): void;
}

const productionRuntime: MigrationRuntime = {
	readProductionUrl,
	loadManifest: loadMigrationManifest,
	currentWorkingDirectory: () => process.cwd(),
	openLedger(databaseUrl, repositoryRoot) {
		const sql = postgres(databaseUrl, { max: 1 });
		const database = drizzle(sql);
		return {
			async acquireLock() {
				await sql`set lock_timeout = '30s'`;
				await sql`select pg_advisory_lock(${MIGRATION_LOCK_NAMESPACE}, ${MIGRATION_LOCK_KEY})`;
			},
			read: () => readLedger(sql),
			migrate: () => migrate(database, { migrationsFolder: join(repositoryRoot, 'drizzle') }),
			async releaseLock() {
				const [{ unlocked }] = await sql<{ unlocked: boolean }[]>`
					select pg_advisory_unlock(${MIGRATION_LOCK_NAMESPACE}, ${MIGRATION_LOCK_KEY}) as unlocked
				`;
				if (!unlocked) {
					throw new Error('Production migration advisory lock was not held');
				}
			},
			close: () => sql.end(),
		};
	},
	log: (message) => console.log(message),
	error: (message) => console.error(message),
};

function emitState(
	runtime: MigrationRuntime,
	result: MigrationReconciliation,
	manifest: readonly MigrationManifestEntry[],
) {
	for (const line of formatState(result, manifest)) {
		runtime.log(line);
	}
}

export function redactDatabaseDetails(message: string, databaseUrl: string | undefined): string {
	if (!databaseUrl) {
		return message;
	}
	let redacted = message.replaceAll(databaseUrl, '<redacted>');
	try {
		const url = new URL(databaseUrl);
		const urlRepresentations = new Set([
			url.href,
			decodeURIComponent(databaseUrl),
			decodeURIComponent(url.href),
		]);
		for (const representation of urlRepresentations) {
			redacted = redacted.replaceAll(representation, '<redacted>');
		}
		const sensitiveValues = new Set([
			url.username,
			decodeURIComponent(url.username),
			url.password,
			decodeURIComponent(url.password),
			url.host,
			url.hostname,
		]);
		for (const sensitiveValue of sensitiveValues) {
			if (sensitiveValue) {
				redacted = redacted.replaceAll(sensitiveValue, '<redacted>');
			}
		}
	} catch {
		return redacted;
	}
	return redacted;
}

export async function main(
	args = process.argv.slice(2),
	runtime: MigrationRuntime = productionRuntime,
): Promise<number> {
	let databaseUrl: string | undefined;
	let ledger: MigrationLedgerConnection | undefined;
	let lockAcquired = false;
	let returnCode = 1;
	try {
		const options = parseOptions(args);
		databaseUrl = runtime.readProductionUrl();
		const repositoryRoot = runtime.currentWorkingDirectory();
		const manifest = await runtime.loadManifest(repositoryRoot);
		ledger = runtime.openLedger(databaseUrl, repositoryRoot);
		await ledger.acquireLock();
		lockAcquired = true;
		let result = reconcileMigrationHistory(manifest, await ledger.read());
		emitState(runtime, result, manifest);

		if (result.status === 'exact') {
			returnCode = 0;
		} else if (result.status === 'pending' && !options.check) {
			if (!options.yes) {
				runtime.error('Migration not run: pass --yes to apply pending migrations.');
			} else {
				await ledger.migrate();
				result = reconcileMigrationHistory(manifest, await ledger.read());
				emitState(runtime, result, manifest);
				returnCode = result.status === 'exact' ? 0 : 1;
			}
		}
	} catch (error) {
		const message = redactDatabaseDetails(
			error instanceof Error ? error.message : 'unknown error',
			databaseUrl,
		);
		runtime.error(`Migration verification failed: ${message}`);
		returnCode = 1;
	} finally {
		if (ledger && lockAcquired) {
			try {
				await ledger.releaseLock();
			} catch (error) {
				const message = redactDatabaseDetails(
					error instanceof Error ? error.message : 'unknown error',
					databaseUrl,
				);
				runtime.error(`Migration lock release failed: ${message}`);
				returnCode = 1;
			}
		}
		if (ledger) {
			try {
				await ledger.close();
			} catch (error) {
				const message = redactDatabaseDetails(
					error instanceof Error ? error.message : 'unknown error',
					databaseUrl,
				);
				runtime.error(`Migration connection close failed: ${message}`);
				returnCode = 1;
			}
		}
	}
	return returnCode;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	process.exitCode = await main();
}
