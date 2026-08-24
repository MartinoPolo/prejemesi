import { loadMigrationManifest } from './migration-history.js';

try {
	const manifest = await loadMigrationManifest(process.cwd());
	const first = manifest[0].tag;
	const latest = manifest.at(-1)?.tag ?? first;
	console.log(`Migration manifest valid: ${manifest.length} migrations (${first} → ${latest})`);
} catch (error) {
	console.error(
		`Migration manifest invalid: ${error instanceof Error ? error.message : 'unknown error'}`,
	);
	process.exitCode = 1;
}
