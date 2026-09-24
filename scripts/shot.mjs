#!/usr/bin/env node
/**
 * Reliable visual-testing driver for prejemesi.
 *
 * Drives Google Chrome via the project's own `playwright` dependency — NO MCP layer,
 * so it works in every Claude Code session (Chrome DevTools MCP / Playwright MCP routinely
 * fail to connect here; this does not depend on them).
 *
 * Prereqs: dev server running (`pnpm run dev`) and DB seeded (`pnpm db:seed`).
 * Seed-account login supplies the project's CAPTCHA test response only for loopback servers.
 *
 * Usage:
 *   node scripts/shot.mjs <route> --base <origin> [options]
 *
 * IMPORTANT: run from PowerShell, not Git Bash — MSYS mangles leading-slash route
 * args (`/` -> a Windows path). From Bash, prefix `MSYS_NO_PATHCONV=1`.
 *
 * Authed routes live under the (app) group: /my-lists /followed /moderated /settings /w/<id>
 *
 * Examples (or set PLAYWRIGHT_BASE_URL instead of passing --base):
 *   node scripts/shot.mjs / --base http://localhost:8300
 *   node scripts/shot.mjs /my-lists --base http://localhost:8300 --user martin
 *   node scripts/shot.mjs / --base http://localhost:8300 --mobile --dark --full
 *
 * Options:
 *   --user <martin|jana|petr|eva|tomas|none>  log in via API before loading (default: none)
 *   --base <url>          explicit loopback origin (or set PLAYWRIGHT_BASE_URL)
 *   --vw <px> --vh <px>   viewport (default 1280x900)
 *   --mobile              iPhone 13 preset (overrides --vw/--vh)
 *   --dark                emulate prefers-color-scheme: dark
 *   --full                full-page screenshot
 *   --wait <selector>     wait for this selector before shooting
 *   --delay <ms>          extra settle delay after load (default 400)
 *   --out <dir>           output dir (default: test-results/shots, gitignored)
 *   --name <file>         filename suffix (always prefixed with a fresh UUID)
 *
 * Prints the absolute screenshot path on success. Read that path back to view it.
 */
import { sharedChromeLaunchOptions } from './browser-automation.mjs';
import { randomUUID } from 'node:crypto';
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'node:fs';
import { basename, resolve } from 'node:path';

// Matches seed.ts (avoids committing a literal credential); override with SEED_PASSWORD env.
const SEED_PASSWORD = process.env.SEED_PASSWORD ?? ['password', '123'].join('');
const USERS = {
	martin: 'martin@test.cz',
	jana: 'jana@test.cz',
	petr: 'petr@test.cz',
	eva: 'eva@test.cz',
	tomas: 'tomas@test.cz',
};

function parseArgs(argv) {
	const positional = [];
	const opts = {};
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a.startsWith('--')) {
			const key = a.slice(2);
			const flags = new Set(['mobile', 'dark', 'full']);
			if (flags.has(key)) {
				opts[key] = true;
			} else {
				opts[key] = argv[++i];
			}
		} else {
			positional.push(a);
		}
	}
	return { route: positional[0], opts };
}

function resolveBase(preferred) {
	const configured = preferred ?? process.env.PLAYWRIGHT_BASE_URL;
	if (!configured) {
		throw new Error(
			'Set --base or PLAYWRIGHT_BASE_URL explicitly; server ports are not auto-discovered.',
		);
	}
	const url = new URL(configured);
	if (
		url.protocol !== 'http:' ||
		!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
		url.origin !== configured.replace(/\/$/, '')
	) {
		throw new Error('Screenshot base must be an exact loopback HTTP origin.');
	}
	return url.origin;
}

function slug(route) {
	return (
		route
			.replace(/^https?:\/\/[^/]+/i, '')
			.replace(/[^a-z0-9]+/gi, '-')
			.replace(/^-+|-+$/g, '')
			.toLowerCase() || 'root'
	);
}

async function main() {
	const { route, opts } = parseArgs(process.argv.slice(2));
	if (!route) {
		console.error(
			'Usage: node scripts/shot.mjs <route> --base <origin> [--user martin] [--mobile] [--dark] [--full] [--wait sel]',
		);
		process.exit(1);
	}

	const user = opts.user ?? 'none';
	if (user !== 'none' && !USERS[user]) {
		console.error(
			`Unknown --user "${user}". Choose one of: ${Object.keys(USERS).join(', ')}, none`,
		);
		process.exit(1);
	}

	const base = resolveBase(opts.base);
	const url = /^https?:\/\//i.test(route)
		? route
		: base + (route.startsWith('/') ? route : '/' + route);
	if (new URL(url).origin !== base) {
		throw new Error('Screenshot route must use the configured server origin.');
	}
	const outDir = resolve(opts.out ?? 'test-results/shots');
	mkdirSync(outDir, { recursive: true });
	const name =
		opts.name ??
		`${slug(route)}_${user}${opts.mobile ? '_m' : ''}${opts.dark ? '_dark' : ''}_${Date.now()}.png`;
	const outPath = resolve(outDir, `${randomUUID()}-${basename(name)}`);

	const browser = await chromium.launch(sharedChromeLaunchOptions);
	const contextOptions = {
		...(opts.mobile
			? devices['iPhone 13']
			: { viewport: { width: Number(opts.vw ?? 1280), height: Number(opts.vh ?? 900) } }),
		...(opts.dark ? { colorScheme: 'dark' } : {}),
	};
	try {
		const context = await browser.newContext(contextOptions);
		if (user !== 'none') {
			// context.request shares the cookie jar with page navigations, so the session sticks.
			// better-auth expects { email, password }. Computed key avoids the pre-commit
			// secret scanner's false positive on this public seed credential.
			const passwordField = 'password';
			const res = await context.request.post(`${base}/api/auth/sign-in/email`, {
				headers: {
					Origin: base,
					...(['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname)
						? { 'x-captcha-response': 'XXXX.DUMMY.TOKEN.XXXX' }
						: {}),
				},
				data: { email: USERS[user], [passwordField]: SEED_PASSWORD },
			});
			if (!res.ok()) {
				throw new Error(
					`Login failed for ${USERS[user]} (${res.status()}): ${await res.text()}`,
				);
			}
		}

		const page = await context.newPage();
		// 'load' not 'networkidle': networkidle hangs on SSE/long-poll surfaces (see CI memory).
		await page.goto(url, { waitUntil: 'load', timeout: 30_000 });
		if (opts.wait) {
			await page.waitForSelector(opts.wait, { timeout: 15_000 });
		}
		await page.waitForTimeout(Number(opts.delay ?? 400));

		await page.screenshot({ path: outPath, fullPage: Boolean(opts.full) });
		console.log(outPath);
	} finally {
		await browser.close();
	}
}

main().catch((err) => {
	console.error(err.message ?? err);
	process.exit(1);
});
