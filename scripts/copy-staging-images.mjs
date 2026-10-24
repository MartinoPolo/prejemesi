// Copies every R2 object the staging database references from the production bucket into
// the staging bucket, so staging renders and deletes images without touching production.
// Reads STAGING_DATABASE_URL from the environment or the gitignored .env.staging.
// Usage: node scripts/copy-staging-images.mjs (see docs/STAGING.md)
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import postgres from 'postgres';

const PRODUCTION_IMAGES_ORIGIN = 'https://images.prejemesi.cz';
const STAGING_IMAGES_ORIGIN = 'https://staging-images.prejemesi.cz';
const STAGING_BUCKET = 'prejemesi-images-staging';
const REQUEST_TIMEOUT_MS = 30_000;

process.loadEnvFile?.('.env.staging');
const databaseUrl = process.env.STAGING_DATABASE_URL;
if (databaseUrl === undefined || databaseUrl === '') {
	throw new Error('STAGING_DATABASE_URL is not set (env or .env.staging).');
}

async function fetchWithTimeout(url) {
	return fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
}

async function referencedKeys() {
	const sql = postgres(databaseUrl, { max: 1, connect_timeout: 30 });
	try {
		const rows = await sql`
			select image_key as key from gift where image_key is not null and image_key <> ''
			union select image_key from wishlist where image_key is not null and image_key <> ''
			union select object_key from agent_image
		`;
		return rows.map((row) => row.key);
	} finally {
		await sql.end({ timeout: 5 });
	}
}

const keys = await referencedKeys();
const workDirectory = mkdtempSync(join(tmpdir(), 'staging-images-'));
const summary = { copied: 0, present: 0, missing: 0 };

try {
	for (const [index, key] of keys.entries()) {
		const encodedKey = key.split('/').map(encodeURIComponent).join('/');
		const existing = await fetchWithTimeout(`${STAGING_IMAGES_ORIGIN}/${encodedKey}`);
		if (existing.ok) {
			summary.present++;
			continue;
		}
		const source = await fetchWithTimeout(`${PRODUCTION_IMAGES_ORIGIN}/${encodedKey}`);
		if (!source.ok) {
			summary.missing++;
			console.warn(`missing in production (${source.status}): ${key}`);
			continue;
		}
		const file = join(workDirectory, String(index));
		writeFileSync(file, Buffer.from(await source.arrayBuffer()));
		const contentType = source.headers.get('content-type') ?? 'application/octet-stream';
		execFileSync(
			process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
			[
				'exec',
				'wrangler',
				'r2',
				'object',
				'put',
				`${STAGING_BUCKET}/${key}`,
				'--file',
				file,
				'--content-type',
				contentType,
				'--remote',
			],
			{ stdio: ['ignore', 'ignore', 'inherit'], shell: process.platform === 'win32' },
		);
		summary.copied++;
	}
} finally {
	rmSync(workDirectory, { recursive: true, force: true });
}

console.log(`${keys.length} referenced: ${JSON.stringify(summary)}`);
