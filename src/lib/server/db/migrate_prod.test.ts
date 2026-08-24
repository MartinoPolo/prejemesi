import { describe, expect, it } from 'vitest';
import {
	formatState,
	main,
	parseOptions,
	productionDatabaseTargetFingerprint,
	redactDatabaseDetails,
	validateProductionDatabaseUrl,
	type MigrationRuntime,
} from '../../../../scripts/migrate-prod.js';
import type {
	MigrationLedgerRow,
	MigrationManifestEntry,
} from '../../../../scripts/migration-history.js';

const manifest: MigrationManifestEntry[] = [
	{
		idx: 0,
		tag: '0000_first',
		when: 100n,
		hash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
	},
	{
		idx: 1,
		tag: '0001_second',
		when: 200n,
		hash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
	},
];

describe('production migration options', () => {
	it('requires explicit mutation authorization', () => {
		expect(parseOptions([])).toEqual({ check: false, yes: false });
		expect(parseOptions(['--yes'])).toEqual({ check: false, yes: true });
		expect(parseOptions(['--', '--yes'])).toEqual({ check: false, yes: true });
		expect(parseOptions(['--check'])).toEqual({ check: true, yes: false });
	});

	it('rejects ambiguous or unknown options', () => {
		expect(() => parseOptions(['--check', '--yes'])).toThrow(/cannot be used together/);
		expect(() => parseOptions(['--force'])).toThrow(/unknown option/i);
	});
});

describe('production database target', () => {
	it('accepts the pinned direct Neon PostgreSQL target', () => {
		const value = 'postgresql://user:secret@ep-example.eu-central-1.aws.neon.tech/app';
		expect(
			validateProductionDatabaseUrl(value, productionDatabaseTargetFingerprint(value)),
		).toBe(value);
	});

	it('rejects a different direct Neon target by default', () => {
		expect(() =>
			validateProductionDatabaseUrl(
				'postgresql://user:secret@ep-example.eu-central-1.aws.neon.tech/app',
			),
		).toThrow(/pinned production database target/);
	});

	it.each([
		['invalid URL', 'not-a-url'],
		['non-PostgreSQL URL', 'https://ep-example.eu-central-1.aws.neon.tech/app'],
		['non-Neon database', 'postgresql://user:secret@example.com/app'],
		[
			'multihost URL ending in Neon',
			'postgresql://user:secret@non-neon.example,ep-example.neon.tech/app',
		],
		[
			'multihost URL starting with Neon',
			'postgresql://user:secret@ep-example.neon.tech,non-neon.example/app',
		],
		[
			'pooled Neon database',
			'postgresql://user:secret@ep-example-pooler.eu-central-1.aws.neon.tech/app',
		],
		[
			'percent-encoded pooled Neon database',
			'postgresql://user:secret@ep-example%2Dpooler.eu-central-1.aws.neon.tech/app',
		],
		[
			'percent-encoded multihost URL',
			'postgresql://user:secret@ep-example.neon.tech%2Cexample.com/app',
		],
		[
			'host query override',
			'postgresql://user:secret@ep-example.neon.tech/app?host=example.com',
		],
		[
			'hostname query override',
			'postgresql://user:secret@ep-example.neon.tech/app?hostname=example.com',
		],
		['port query override', 'postgresql://user:secret@ep-example.neon.tech/app?port=6543'],
		[
			'database query override',
			'postgresql://user:secret@ep-example.neon.tech/app?database=other',
		],
		['user query override', 'postgresql://user:secret@ep-example.neon.tech/app?user=other'],
		[
			'password query override',
			'postgresql://user:secret@ep-example.neon.tech/app?password=other',
		],
	])('rejects %s', (_label, value) => {
		expect(() => validateProductionDatabaseUrl(value)).toThrow();
	});
});

interface RuntimeObservation {
	logs: string[];
	errors: string[];
	migrationCount: number;
	lockAcquired: boolean;
	lockReleased: boolean;
	closed: boolean;
}

function fakeRuntime(ledgerSnapshots: MigrationLedgerRow[][]): {
	runtime: MigrationRuntime;
	observation: RuntimeObservation;
} {
	const observation: RuntimeObservation = {
		logs: [],
		errors: [],
		migrationCount: 0,
		lockAcquired: false,
		lockReleased: false,
		closed: false,
	};
	let ledgerReadIndex = 0;
	return {
		observation,
		runtime: {
			readProductionUrl: () =>
				'postgresql://user:secret@ep-example.eu-central-1.aws.neon.tech/app',
			loadManifest: async () => manifest,
			currentWorkingDirectory: () => '/repository',
			openLedger: () => ({
				acquireLock: async () => {
					observation.lockAcquired = true;
				},
				read: async () => ledgerSnapshots[ledgerReadIndex++] ?? [],
				migrate: async () => {
					observation.migrationCount += 1;
				},
				releaseLock: async () => {
					observation.lockReleased = true;
				},
				close: async () => {
					observation.closed = true;
				},
			}),
			log: (message) => observation.logs.push(message),
			error: (message) => observation.errors.push(message),
		},
	};
}

const exactLedger: MigrationLedgerRow[] = manifest.map((migration, index) => ({
	id: index,
	hash: migration.hash,
	createdAt: migration.when,
}));
const pendingLedger = exactLedger.slice(0, 1);
const driftedLedger: MigrationLedgerRow[] = [
	{ id: 0, hash: 'cccccccccccccccccccccccccccccccc', createdAt: manifest[0].when },
];

describe('production migration orchestration', () => {
	it('returns success without migration for exact state', async () => {
		const { runtime, observation } = fakeRuntime([exactLedger]);

		await expect(main([], runtime)).resolves.toBe(0);
		expect(observation.logs).toEqual([
			'Manifest: 2 migrations (0000_first → 0001_second)',
			'EXACT',
		]);
		expect(observation.errors).toEqual([]);
		expect(observation.migrationCount).toBe(0);
		expect(observation.lockAcquired).toBe(true);
		expect(observation.lockReleased).toBe(true);
		expect(observation.closed).toBe(true);
	});

	it('rejects pending state without mutation authorization', async () => {
		const { runtime, observation } = fakeRuntime([pendingLedger]);

		await expect(main([], runtime)).resolves.toBe(1);
		expect(observation.logs.join('\n')).toContain('PENDING: 0001_second');
		expect(observation.errors).toEqual([
			'Migration not run: pass --yes to apply pending migrations.',
		]);
		expect(observation.migrationCount).toBe(0);
		expect(observation.closed).toBe(true);
	});

	it('reports pending state under check mode without migration', async () => {
		const { runtime, observation } = fakeRuntime([pendingLedger]);

		await expect(main(['--check'], runtime)).resolves.toBe(1);
		expect(observation.logs.join('\n')).toContain('PENDING: 0001_second');
		expect(observation.errors).toEqual([]);
		expect(observation.migrationCount).toBe(0);
		expect(observation.closed).toBe(true);
	});

	it('rejects drift even with mutation authorization', async () => {
		const { runtime, observation } = fakeRuntime([driftedLedger]);

		await expect(main(['--yes'], runtime)).resolves.toBe(1);
		expect(observation.logs.join('\n')).toContain('DRIFT:');
		expect(observation.errors).toEqual([]);
		expect(observation.migrationCount).toBe(0);
		expect(observation.closed).toBe(true);
	});

	it('migrates authorized pending state and verifies the exact postcondition', async () => {
		const { runtime, observation } = fakeRuntime([pendingLedger, exactLedger]);

		await expect(main(['--yes'], runtime)).resolves.toBe(0);
		expect(observation.logs.join('\n')).toContain('PENDING: 0001_second');
		expect(observation.logs.at(-1)).toBe('EXACT');
		expect(observation.errors).toEqual([]);
		expect(observation.migrationCount).toBe(1);
		expect(observation.closed).toBe(true);
	});

	it('fails when an authorized migration does not produce an exact postcondition', async () => {
		const { runtime, observation } = fakeRuntime([pendingLedger, pendingLedger]);

		await expect(main(['--yes'], runtime)).resolves.toBe(1);
		expect(observation.logs.filter((line) => line.startsWith('PENDING:'))).toHaveLength(2);
		expect(observation.errors).toEqual([]);
		expect(observation.migrationCount).toBe(1);
		expect(observation.closed).toBe(true);
	});

	it('redacts the production URL from runtime errors', async () => {
		const databaseUrl = 'postgresql://user:secret@ep-example.neon.tech/app';
		const { runtime, observation } = fakeRuntime([exactLedger]);
		runtime.readProductionUrl = () => databaseUrl;
		runtime.openLedger = () => ({
			acquireLock: async () => {},
			read: async () => {
				throw new Error(`Connection failed for ${databaseUrl}`);
			},
			migrate: async () => {},
			releaseLock: async () => {},
			close: async () => {
				observation.closed = true;
			},
		});

		await expect(main([], runtime)).resolves.toBe(1);
		expect(observation.errors.join('\n')).toContain('<redacted>');
		expect(observation.errors.join('\n')).not.toContain(databaseUrl);
		expect(observation.errors.join('\n')).not.toContain('secret');
		expect(observation.migrationCount).toBe(0);
		expect(observation.closed).toBe(true);
	});

	it('redacts credentials and host details from subprocess output', () => {
		const databaseUrl = 'postgresql://deploy-user:secret@ep-example.neon.tech/app';
		const output = redactDatabaseDetails(
			`connection to ep-example.neon.tech failed for deploy-user with secret via ${databaseUrl}`,
			databaseUrl,
		);

		expect(output).not.toContain('deploy-user');
		expect(output).not.toContain('secret');
		expect(output).not.toContain('ep-example.neon.tech');
		expect(output).toContain('<redacted>');
	});
});

describe('migration state output', () => {
	it('reports exact and pending states with migration tags', () => {
		expect(formatState({ status: 'exact' }, manifest)).toEqual([
			'Manifest: 2 migrations (0000_first → 0001_second)',
			'EXACT',
		]);
		expect(formatState({ status: 'pending', pending: [manifest[1]] }, manifest)).toEqual([
			'Manifest: 2 migrations (0000_first → 0001_second)',
			'PENDING: 0001_second',
		]);
	});
});
