import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const checkerPath = fileURLToPath(
	new URL('../../../../scripts/check-migration-safety.mjs', import.meta.url),
);

async function runMigrationSafetyCheck(sql: string, contractMigrations: Record<string, string>) {
	const repositoryRoot = await mkdtemp(join(tmpdir(), 'migration-safety-'));
	try {
		await mkdir(join(repositoryRoot, 'drizzle', 'meta'), { recursive: true });
		await writeFile(join(repositoryRoot, 'drizzle', '0000_contract.sql'), sql);
		await writeFile(
			join(repositoryRoot, 'drizzle', 'meta', 'contract-migrations.json'),
			JSON.stringify(contractMigrations),
		);
		return spawnSync(process.execPath, [checkerPath], {
			cwd: repositoryRoot,
			encoding: 'utf8',
		});
	} finally {
		await rm(repositoryRoot, { recursive: true, force: true });
	}
}

describe('migration safety contract acknowledgments', () => {
	it('rejects a destructive migration without a rationale', async () => {
		const result = await runMigrationSafetyCheck('DROP TABLE "gift";\n', {});

		expect(result.error).toBeUndefined();
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('Migration safety check failed');
		expect(result.stderr).toContain('DROP TABLE');
	});

	it('accepts a destructive migration with a nonempty matching rationale', async () => {
		const result = await runMigrationSafetyCheck('DROP TABLE "gift";\n', {
			'0000_contract': 'Old application versions no longer read this table.',
		});

		expect(result.error).toBeUndefined();
		expect(result.status).toBe(0);
		expect(result.stdout).toContain('Migration safety check passed');
		expect(result.stderr).toBe('');
	});

	it('rejects an empty rationale', async () => {
		const result = await runMigrationSafetyCheck('DROP TABLE "gift";\n', {
			'0000_contract': '   ',
		});

		expect(result.error).toBeUndefined();
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('has no rationale for 0000_contract');
	});

	it('rejects a stale or unknown rationale', async () => {
		const result = await runMigrationSafetyCheck('SELECT 1;\n', {
			'9999_unknown': 'This tag does not identify a destructive migration.',
		});

		expect(result.error).toBeUndefined();
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('stale or unknown entries: 9999_unknown');
	});
});
