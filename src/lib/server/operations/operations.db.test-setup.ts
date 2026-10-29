import { expect, vi } from 'vitest';
import { eq, like, sql } from 'drizzle-orm';

vi.mock('$app/server', () => ({
	getRequestEvent: vi.fn(() => {
		throw new Error('no request context');
	}),
}));
vi.mock('$env/dynamic/private', () => ({ env: { DATABASE_URL: process.env.DATABASE_URL } }));
vi.mock('$lib/server/storage/r2.js', async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	deleteObjectsBestEffort: vi.fn(),
}));
vi.mock('$lib/server/anonymous_visitor.js', () => ({ getAnonVisitorId: vi.fn(() => null) }));
vi.mock('$lib/modules/notifications/notification_dispatcher.js', () => ({
	dispatchNotification: vi.fn(),
}));
// Captures after-response work (the revision purge) so a test can await it.
vi.mock('$lib/server/background.js', () => ({ runAfterResponse: vi.fn() }));

import { closeDb, getDb, type DatabaseTransaction } from '$lib/server/db/index.js';
import { user } from '$lib/server/db/auth.schema.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { moderatorAssignment } from '$lib/server/db/moderator.schema.js';
import { gift, reservation } from '$lib/server/db/gift.schema.js';
import { giftRevision } from '$lib/server/db/gift_revision.schema.js';
import type { WishlistKind } from '$lib/modules/wishlists/types.js';
import { OPERATION_CHANNEL, tokenChannel, type OperationActor } from './actor.js';

const databaseUrl = process.env.DATABASE_URL ?? '';

function isLocalDatabaseUrl(value: string): boolean {
	try {
		const hostname = new URL(value).hostname.toLowerCase();
		return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
	} catch {
		return false;
	}
}

/** Unique per test file so parallel files never touch each other's rows. */
const PREFIX = `test-operations-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-`;
export const RECIPIENT_ID = `${PREFIX}recipient`;
export const MANAGER_ID = `${PREFIX}manager`;
const OUTSIDER_ID = `${PREFIX}outsider`;
export const RESERVER_ID = `${PREFIX}reserver`;
export const SECOND_RESERVER_ID = `${PREFIX}second-reserver`;
export const RESERVER_NAME = 'Reserving gifter';
export const RESERVER_EMAIL = `${PREFIX}reserver@example.com`;

export const recipientActor: OperationActor = {
	userId: RECIPIENT_ID,
	userName: 'Recipient',
	channel: OPERATION_CHANNEL.ui,
	isAppAdministrator: false,
};
export const managerActor: OperationActor = {
	userId: MANAGER_ID,
	userName: 'Manager',
	channel: tokenChannel('test-agent'),
	isAppAdministrator: false,
};
export const outsiderActor: OperationActor = {
	userId: OUTSIDER_ID,
	userName: 'Outsider',
	channel: OPERATION_CHANNEL.ui,
	isAppAdministrator: false,
};

class ProbeRollback extends Error {}

async function isDbUsable(): Promise<boolean> {
	if (!isLocalDatabaseUrl(databaseUrl)) {
		return false;
	}
	try {
		await getDb().transaction(async (transaction) => {
			await transaction.select({ id: giftRevision.id }).from(giftRevision).limit(1);
			throw new ProbeRollback();
		});
		return true;
	} catch (caught) {
		if (caught instanceof ProbeRollback) {
			return true;
		}
		await closeDb().catch(() => undefined);
		return false;
	}
}

export const DB_READY = await isDbUsable();

let fixtureCounter = 0;
export function fixtureId(label: string): string {
	fixtureCounter += 1;
	return `${PREFIX}${label}-${fixtureCounter}`;
}

export async function seedFixtureUsers(): Promise<void> {
	await getDb()
		.insert(user)
		.values([
			{ id: RECIPIENT_ID, name: 'Recipient', email: `${PREFIX}recipient@example.com` },
			{ id: MANAGER_ID, name: 'Manager', email: `${PREFIX}manager@example.com` },
			{ id: OUTSIDER_ID, name: 'Outsider', email: `${PREFIX}outsider@example.com` },
			{ id: RESERVER_ID, name: RESERVER_NAME, email: RESERVER_EMAIL },
			{
				id: SECOND_RESERVER_ID,
				name: 'Second gifter',
				email: `${PREFIX}second-reserver@example.com`,
			},
		]);
}

export async function removeFixtureRows(): Promise<void> {
	if (!DB_READY) {
		return;
	}
	await getDb()
		.delete(wishlist)
		.where(like(wishlist.id, `${PREFIX}%`));
	await getDb()
		.delete(user)
		.where(like(user.id, `${PREFIX}%`));
	await closeDb();
}

/** A wishlist whose linked recipient is {@link RECIPIENT_ID}, with {@link MANAGER_ID} as správce. */
export async function createWishlistFixture(
	options: {
		sharedAt?: Date | null;
		status?: 'draft' | 'active' | 'archived';
		recipientIsModerator?: boolean;
		kind?: WishlistKind;
		eventDate?: Date | null;
	} = {},
): Promise<{ id: string; shortId: string }> {
	const id = fixtureId('wishlist');
	const shortId = fixtureId('short');
	await getDb()
		.insert(wishlist)
		.values({
			id,
			shortId,
			title: 'Operation core wishlist',
			recipientUserId: RECIPIENT_ID,
			status: options.status ?? (options.sharedAt ? 'active' : 'draft'),
			sharedAt: options.sharedAt ?? null,
			firstSharedAt: options.sharedAt ?? null,
			recipientIsModerator: options.recipientIsModerator ?? false,
			...(options.kind === undefined ? {} : { kind: options.kind }),
			eventDate: options.eventDate ?? null,
		});
	await getDb().insert(moderatorAssignment).values({ wishlistId: id, userId: MANAGER_ID });
	return { id, shortId };
}

export async function createGiftFixture(
	wishlistId: string,
	values: Partial<typeof gift.$inferInsert> = {},
): Promise<string> {
	const id = fixtureId('gift');
	await getDb()
		.insert(gift)
		.values({ id, wishlistId, name: `Gift ${id}`, ...values });
	return id;
}

export async function reserveGift(giftId: string, userId: string): Promise<void> {
	await getDb().insert(reservation).values({ giftId, userId });
}

export async function readGift(giftId: string) {
	const [row] = await getDb().select().from(gift).where(eq(gift.id, giftId));
	if (row === undefined) {
		throw new Error(`Missing gift ${giftId}`);
	}
	return row;
}

export async function revisionsForGift(giftId: string) {
	return getDb().select().from(giftRevision).where(eq(giftRevision.giftId, giftId));
}

export function errorMessage(thrown: unknown): string {
	if (
		typeof thrown === 'object' &&
		thrown !== null &&
		'body' in thrown &&
		typeof thrown.body === 'object' &&
		thrown.body !== null &&
		'message' in thrown.body &&
		typeof thrown.body.message === 'string'
	) {
		return thrown.body.message;
	}
	return '';
}

export async function captureError(work: Promise<unknown>): Promise<unknown> {
	try {
		await work;
	} catch (thrown) {
		return thrown;
	}
	throw new Error('Expected the operation to fail');
}

export async function expectRejection(work: Promise<unknown>, status: number, message: string) {
	const thrown = await captureError(work);
	expect(thrown).toMatchObject({ status });
	expect(errorMessage(thrown)).toBe(message);
}

export function expectRejectionResult(
	result: PromiseSettledResult<unknown>,
	status: number,
	message: string,
) {
	if (result.status !== 'rejected') {
		throw new Error('Expected the operation to fail');
	}
	expect(result.reason).toMatchObject({ status });
	expect(errorMessage(result.reason)).toBe(message);
}

async function waitUntilBlockedBy(holderPid: number, expectedWaiters: number): Promise<void> {
	for (let attempt = 0; attempt < 200; attempt += 1) {
		const [row] = await getDb().execute<{ waiting: number }>(sql`
			with recursive blocked(pid) as (
				select pid from pg_stat_activity where ${holderPid} = any(pg_blocking_pids(pid))
				union
				select activity.pid from pg_stat_activity activity, blocked
				where blocked.pid = any(pg_blocking_pids(activity.pid))
			)
			select count(*)::int as waiting from blocked`);
		if ((row?.waiting ?? 0) >= expectedWaiters) {
			return;
		}
		await new Promise((resolve) => setTimeout(resolve, 25));
	}
	throw new Error(`Expected ${expectedWaiters} contenders waiting on the held lock`);
}

function settle(work: () => Promise<unknown>): Promise<PromiseSettledResult<unknown>> {
	return Promise.resolve()
		.then(work)
		.then(
			(value): PromiseSettledResult<unknown> => ({ status: 'fulfilled', value }),
			(reason: unknown): PromiseSettledResult<unknown> => ({ status: 'rejected', reason }),
		);
}

/**
 * Runs the contenders while another transaction holds a row they need, and releases it only once
 * all of them wait, so they genuinely overlap instead of finishing one after another.
 * `queueInOrder` starts each contender only after the previous one waits, fixing which locks each
 * holds when the row is released.
 */
export async function raceBehindRowLock(
	lockRow: (transaction: DatabaseTransaction) => Promise<unknown>,
	contenders: ReadonlyArray<() => Promise<unknown>>,
	options: { queueInOrder?: boolean } = {},
): Promise<PromiseSettledResult<unknown>[]> {
	let releaseRow = () => {};
	const rowReleased = new Promise<void>((resolve) => (releaseRow = resolve));
	let reportHolder: (holderPid: number) => void = () => {};
	const holderReady = new Promise<number>((resolve) => (reportHolder = resolve));
	const holder = getDb().transaction(async (transaction) => {
		await lockRow(transaction);
		const [row] = await transaction.execute<{ pid: number }>(
			sql`select pg_backend_pid() as pid`,
		);
		reportHolder(row?.pid ?? 0);
		await rowReleased;
	});
	try {
		const holderPid = await Promise.race([holderReady, holder.then(() => 0)]);
		const outcomes: Promise<PromiseSettledResult<unknown>>[] = [];
		for (const contender of contenders) {
			outcomes.push(settle(contender));
			if (options.queueInOrder === true) {
				await waitUntilBlockedBy(holderPid, outcomes.length);
			}
		}
		await waitUntilBlockedBy(holderPid, contenders.length);
		releaseRow();
		return await Promise.all(outcomes);
	} finally {
		releaseRow();
		await holder;
	}
}
