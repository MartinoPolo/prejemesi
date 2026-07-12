/**
 * Load-test runner (issue #110).
 *
 * Profiles (REQ-4):
 *   sustained-10 — 10 concurrent users, interactive mixed workload with think
 *                  time, default 120 s.
 *   burst-100    — 100 concurrent users, bounded burst (each VU runs one fixed
 *                  sequence, then all race for one gift).
 *   contention   — pure final-unit race (AC-6 verification).
 *   smoke        — 2 VUs, one pass through every scenario (endpoint sanity).
 *
 * Usage:
 *   pnpm loadtest --profile smoke
 *   pnpm loadtest --profile sustained-10 [--duration 120] [--vus 10]
 *   pnpm loadtest --profile burst-100
 *   pnpm loadtest --target preview --profile smoke
 *   pnpm loadtest --url https://… --allow-production --profile smoke
 *
 * Requires fixtures: pnpm loadtest:setup (see docs/LOAD_TESTING.md).
 */

import { join } from 'node:path';
import {
	LOADTEST_PASSWORD,
	MAX_VIRTUAL_USERS,
	TARGETS,
	assertRemoteTargetAuthorized,
	isLocalHostname,
	type TargetName,
} from './config.js';
import {
	assertDatabaseAuthorized,
	connectDb,
	countActiveReservations,
	findOverReservedGifts,
	resetLoadTestReservations,
	resolveDatabaseUrl,
	snapshotStatementCount,
	type DbHandle,
} from './db.js';
import { CONTENTION_GIFT_ID, distinctGiftId, virtualUserEmail } from './fixtures.js';
import { VirtualUserClient } from './http-client.js';
import { MetricsRecorder } from './metrics.js';
import { writeReportFiles, renderMarkdown, type LoadTestReport } from './report.js';
import {
	contendForGift,
	createGiftOnOwnWishlist,
	reserveAndReleaseDistinctGift,
	unreserveGift,
	viewArenaWishlist,
	type ContentionOutcome,
	type VirtualUser,
} from './scenarios.js';

// ── CLI ─────────────────────────────────────────────────────────────────────

interface CliOptions {
	profile: 'smoke' | 'sustained-10' | 'burst-100' | 'contention';
	targetUrl: string;
	virtualUsers: number;
	durationSeconds: number;
	allowProduction: boolean;
}

const PROFILE_DEFAULT_VUS = {
	smoke: 2,
	'sustained-10': 10,
	'burst-100': 100,
	contention: 10,
} as const;

function parseCliOptions(argv: readonly string[]): CliOptions {
	const readValue = (flag: string): string | undefined => {
		const index = argv.indexOf(flag);
		return index !== -1 ? argv[index + 1] : undefined;
	};

	const profile = (readValue('--profile') ?? 'smoke') as CliOptions['profile'];
	if (!(profile in PROFILE_DEFAULT_VUS)) {
		throw new Error(
			`Unknown profile "${profile}". Use one of: ${Object.keys(PROFILE_DEFAULT_VUS).join(', ')}`,
		);
	}

	const targetName = (readValue('--target') ?? 'local') as TargetName;
	const customUrl = readValue('--url');
	if (customUrl === undefined && !(targetName in TARGETS)) {
		throw new Error(
			`Unknown target "${targetName}". Use one of: ${Object.keys(TARGETS).join(', ')} or --url.`,
		);
	}
	const targetUrl = (customUrl ?? TARGETS[targetName]).replace(/\/$/, '');

	const virtualUsers = Number(readValue('--vus') ?? PROFILE_DEFAULT_VUS[profile]);
	if (!Number.isInteger(virtualUsers) || virtualUsers < 1 || virtualUsers > MAX_VIRTUAL_USERS) {
		throw new Error(`--vus must be an integer between 1 and ${String(MAX_VIRTUAL_USERS)}.`);
	}

	return {
		profile,
		targetUrl,
		virtualUsers,
		durationSeconds: Number(readValue('--duration') ?? 120),
		allowProduction: argv.includes('--allow-production'),
	};
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Deterministic per-VU PRNG (mulberry32) so runs are repeatable. */
function createPrng(seed: number): () => number {
	let state = seed + 0x6d2b79f5;
	return () => {
		state = Math.imul(state ^ (state >>> 15), state | 1);
		state ^= state + Math.imul(state ^ (state >>> 7), state | 61);
		return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
	};
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Staggered login for authed VUs (better-auth rate-limits sign-in bursts in
 * production). Logins are recorded as `auth:login` samples but happen before
 * the measured scenario phase.
 */
async function loginAuthedUsers(vus: VirtualUser[]): Promise<void> {
	const authedVus = vus.filter((vu) => vu.authenticated);
	const concurrency = 5;
	for (let start = 0; start < authedVus.length; start += concurrency) {
		await Promise.all(
			authedVus.slice(start, start + concurrency).map(async (vu) => {
				for (let attempt = 0; attempt < 3; attempt++) {
					const loggedIn = await vu.client.login(
						virtualUserEmail(vu.index),
						LOADTEST_PASSWORD,
					);
					if (loggedIn) {
						return;
					}
					await sleep(500 * (attempt + 1));
				}
				console.warn(`VU ${String(vu.index)}: login failed — continuing anonymously.`);
				vu.authenticated = false;
			}),
		);
		await sleep(100);
	}
}

// ── Profiles ────────────────────────────────────────────────────────────────

async function runSustainedProfile(vus: VirtualUser[], durationSeconds: number): Promise<void> {
	const deadline = performance.now() + durationSeconds * 1000;
	await Promise.all(
		vus.map(async (vu) => {
			const random = createPrng(vu.index + 1);
			let iteration = 0;
			while (performance.now() < deadline) {
				iteration++;
				await viewArenaWishlist(vu);
				await sleep(500 + random() * 1000);
				if (iteration % 3 === 0) {
					await reserveAndReleaseDistinctGift(vu, distinctGiftId(vu.index));
				}
				if (vu.authenticated && iteration % 5 === 0) {
					await createGiftOnOwnWishlist(vu, iteration);
				}
				await sleep(500 + random() * 1000);
			}
		}),
	);
}

async function runBurstPhase(vus: VirtualUser[], creatorCount: number): Promise<void> {
	await Promise.all(
		vus.map(async (vu) => {
			await viewArenaWishlist(vu);
			await reserveAndReleaseDistinctGift(vu, distinctGiftId(vu.index));
			if (vu.authenticated && vu.index < creatorCount) {
				await createGiftOnOwnWishlist(vu, 0);
			}
		}),
	);
}

async function runSmokeProfile(vus: VirtualUser[]): Promise<ContentionOutcome> {
	for (const vu of vus) {
		await viewArenaWishlist(vu);
		await reserveAndReleaseDistinctGift(vu, distinctGiftId(vu.index));
		if (vu.authenticated) {
			await createGiftOnOwnWishlist(vu, 0);
		}
	}
	return contendForGift(vus, CONTENTION_GIFT_ID);
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
	const options = parseCliOptions(process.argv.slice(2));
	assertRemoteTargetAuthorized(options.targetUrl, options.allowProduction);

	// Database access is used only for reset/integrity/statement metrics. For a
	// non-local HTTP target, a plain local DATABASE_URL would point at the wrong
	// database — require the explicit LOADTEST_DATABASE_URL instead.
	const targetIsLocal = isLocalHostname(new URL(options.targetUrl).hostname);
	let databaseNote = 'connected';
	let dbHandle: DbHandle | null = null;
	const databaseUrl = targetIsLocal
		? resolveDatabaseUrl()
		: (process.env['LOADTEST_DATABASE_URL'] ?? null);
	if (databaseUrl === null) {
		databaseNote = targetIsLocal
			? 'DATABASE_URL not set'
			: 'remote target without LOADTEST_DATABASE_URL — DB metrics/integrity skipped';
	} else {
		assertDatabaseAuthorized(databaseUrl);
		dbHandle = connectDb(databaseUrl);
	}

	console.log(
		`Profile: ${options.profile} | target: ${options.targetUrl} | VUs: ${String(options.virtualUsers)}`,
	);

	try {
		if (dbHandle !== null) {
			await resetLoadTestReservations(dbHandle.db);
		}

		const metrics = new MetricsRecorder();
		const vus: VirtualUser[] = Array.from({ length: options.virtualUsers }, (_, index) => ({
			index,
			client: new VirtualUserClient(options.targetUrl, metrics),
			authenticated: index % 2 === 0,
		}));

		await loginAuthedUsers(vus);

		const statementsBefore =
			dbHandle === null ? null : await snapshotStatementCount(dbHandle.db);

		const startedAt = new Date().toISOString();
		const startedAtMs = performance.now();
		let contention: ContentionOutcome | null = null;

		switch (options.profile) {
			case 'smoke': {
				contention = await runSmokeProfile(vus);
				break;
			}
			case 'sustained-10': {
				await runSustainedProfile(vus, options.durationSeconds);
				break;
			}
			case 'burst-100': {
				await runBurstPhase(vus, 10);
				contention = await contendForGift(vus, CONTENTION_GIFT_ID);
				break;
			}
			case 'contention': {
				contention = await contendForGift(vus, CONTENTION_GIFT_ID);
				break;
			}
		}
		const durationSeconds = (performance.now() - startedAtMs) / 1000;

		const statementsAfter =
			dbHandle === null || statementsBefore === null || statementsBefore.calls === null
				? null
				: await snapshotStatementCount(dbHandle.db);

		// Integrity is verified while contention reservations are still active;
		// winners release afterwards so reruns start clean.
		let overReservedGifts: Awaited<ReturnType<typeof findOverReservedGifts>> = [];
		let contentionActiveInDb: number | null = null;
		if (dbHandle !== null) {
			overReservedGifts = await findOverReservedGifts(dbHandle.db);
			if (contention !== null) {
				contentionActiveInDb = await countActiveReservations(
					dbHandle.db,
					CONTENTION_GIFT_ID,
				);
			}
		}
		if (contention !== null) {
			for (const winner of contention.successes) {
				const vu = vus[winner.vuIndex];
				if (vu !== undefined) {
					await unreserveGift(vu, winner.reservationId, 'command:unreserveGift-cleanup');
				}
			}
		}

		const errors = metrics.errorTotals();
		const statementDelta =
			statementsBefore?.calls != null && statementsAfter?.calls != null
				? statementsAfter.calls - statementsBefore.calls
				: null;
		const statementNote =
			dbHandle === null
				? databaseNote
				: statementsBefore !== null && statementsBefore.calls === null
					? statementsBefore.reason
					: 'includes all clients of this database during the run';

		const contentionExactlyOneWinner =
			contention === null
				? null
				: contention.successes.length === 1 &&
					contention.unexpectedFailures === 0 &&
					(contentionActiveInDb === null || contentionActiveInDb === 1);

		const acceptance = {
			zeroHttp5xx: errors.http5xx === 0,
			zeroWorkerLimitErrors: errors.cfError1102 === 0 && errors.cfError1027 === 0,
			zeroUnexpectedErrors: errors.unexpectedErrors === 0,
			zeroOverReservation: overReservedGifts.length === 0,
			contentionExactlyOneWinner,
			passed: false,
		};
		acceptance.passed =
			acceptance.zeroHttp5xx &&
			acceptance.zeroWorkerLimitErrors &&
			acceptance.zeroUnexpectedErrors &&
			acceptance.zeroOverReservation &&
			contentionExactlyOneWinner !== false;

		const report: LoadTestReport = {
			profile: options.profile,
			target: options.targetUrl,
			startedAt,
			durationSeconds,
			virtualUsers: options.virtualUsers,
			dynamicRequestCount: errors.requests,
			operations: metrics.summarizeByOperation(),
			errors,
			databaseStatements: { delta: statementDelta, note: statementNote },
			reservationIntegrity: {
				checked: dbHandle !== null,
				overReservedGifts,
				contention:
					contention === null
						? null
						: { ...contention, activeReservationsInDb: contentionActiveInDb },
			},
			acceptance,
		};

		const markdownPath = writeReportFiles(join('tests', 'load', 'reports'), report);
		console.log(`\n${renderMarkdown(report)}`);
		console.log(`Report written to ${markdownPath}`);

		if (!acceptance.passed) {
			process.exitCode = 1;
		}
	} finally {
		await dbHandle?.close();
	}
}

await main();
