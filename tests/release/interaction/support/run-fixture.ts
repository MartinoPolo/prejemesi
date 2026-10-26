import type { WorkerInfo } from '@playwright/test';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const POLL_INTERVAL_MS = 250;
/** How long a worker waits for another worker that is creating the value. */
export const RUN_FIXTURE_WAIT_MS = 180_000;

/**
 * Creates a JSON value once per test run and shares it with every worker, including the fresh
 * worker Playwright starts after each failing test. Files carry the run id that
 * playwright.config.ts sets, so a preserved output directory never hands a later run stale
 * cookies, and a lock left by a creator that died is taken over.
 */
export async function oncePerRun<T>(
	workerInfo: WorkerInfo,
	name: string,
	create: () => Promise<T>,
): Promise<T> {
	const runId = process.env.PLAYWRIGHT_RUN_ID;
	if (runId === undefined || runId === '') {
		throw new Error('PLAYWRIGHT_RUN_ID is unset; playwright.config.ts sets it for every run');
	}
	const directory = workerInfo.project.outputDir;
	await mkdir(directory, { recursive: true });
	const valuePath = join(directory, `${name}.${runId}.run-fixture.json`);
	const lockPath = `${valuePath}.lock`;
	const deadline = Date.now() + RUN_FIXTURE_WAIT_MS;
	while (Date.now() < deadline) {
		const existing = await readValue<T>(valuePath);
		if (existing !== undefined) {
			return existing;
		}
		if (await acquireLock(lockPath)) {
			try {
				const value = await create();
				await writeFile(`${valuePath}.tmp`, JSON.stringify(value));
				await rename(`${valuePath}.tmp`, valuePath);
				return value;
			} catch (error) {
				await rm(lockPath, { force: true });
				throw error;
			}
		}
		const holder = await lockHolder(lockPath);
		if (holder === 'released') {
			const created = await readValue<T>(valuePath);
			if (created !== undefined) {
				return created;
			}
			throw new Error(`Another worker failed to create ${valuePath}`);
		}
		if (holder !== 'unknown' && !isRunning(holder)) {
			await releaseStaleLock(lockPath, holder);
			continue;
		}
		await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
	}
	throw new Error(`Timed out waiting for another worker to create ${valuePath}`);
}

async function readValue<T>(valuePath: string): Promise<T | undefined> {
	try {
		return JSON.parse(await readFile(valuePath, 'utf8')) as T;
	} catch {
		return undefined;
	}
}

async function acquireLock(lockPath: string): Promise<boolean> {
	try {
		await writeFile(lockPath, String(process.pid), { flag: 'wx' });
		return true;
	} catch {
		return false;
	}
}

/** The creator's process id; `unknown` while it is still writing it. */
async function lockHolder(lockPath: string): Promise<number | 'released' | 'unknown'> {
	try {
		const pid = Number.parseInt(await readFile(lockPath, 'utf8'), 10);
		return Number.isNaN(pid) ? 'unknown' : pid;
	} catch {
		return 'released';
	}
}

function isRunning(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		return (error as NodeJS.ErrnoException).code === 'EPERM';
	}
}

/** Removes the lock only while it still names the dead creator, so a new creator keeps its lock. */
async function releaseStaleLock(lockPath: string, deadHolder: number) {
	if ((await lockHolder(lockPath)) === deadHolder) {
		await rm(lockPath, { force: true });
	}
}
