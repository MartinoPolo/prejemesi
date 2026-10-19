import {
	DB_READY,
	MANAGER_ID,
	removeFixtureRows,
	seedFixtureUsers,
} from '$lib/server/operations/operations.db.test-setup.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as v from 'valibot';
import { CreateAccessTokenInputSchema } from '$lib/modules/access_tokens/types.js';
import { createAccessToken } from './access_tokens.js';
import { AGENT_CREDENTIAL_KIND, type IdempotentCredential } from './agent_caller.js';
import {
	IDEMPOTENCY_CLAIM,
	claimIdempotencyKey,
	releaseIdempotencyKey,
	storeIdempotentResponse,
	type IdempotencyScope,
} from './idempotency.js';
import { IDEMPOTENCY_KEY_ABANDONED_AFTER_MS, IDEMPOTENCY_KEY_RETENTION_MS } from './limits.js';

let credential: IdempotentCredential;
let keyCounter = 0;

function freshScope(fingerprint = 'request-a'): IdempotencyScope {
	keyCounter += 1;
	return { credential, key: `key-${keyCounter}`, fingerprint };
}

function later(start: Date, milliseconds: number): Date {
	return new Date(start.getTime() + milliseconds);
}

describe.skipIf(!DB_READY)('idempotency keys', () => {
	beforeAll(async () => {
		await seedFixtureUsers();
		const { token } = await createAccessToken(
			MANAGER_ID,
			v.parse(CreateAccessTokenInputSchema, {
				name: 'Claude',
				scopes: [],
				wishlistIds: null,
			}),
		);
		credential = {
			kind: AGENT_CREDENTIAL_KIND.personalAccessToken,
			id: token.id,
			prefix: token.prefix,
			expiresAt: token.expiresAt,
		};
	});
	afterAll(removeFixtureRows);

	it('claims a new key once and reports it in progress until the first request settles', async () => {
		const scope = freshScope();

		expect(await claimIdempotencyKey(scope)).toEqual({ kind: IDEMPOTENCY_CLAIM.claimed });
		expect(await claimIdempotencyKey(scope)).toEqual({ kind: IDEMPOTENCY_CLAIM.inProgress });
	});

	it('replays a stored response to the same request and refuses a different one', async () => {
		const scope = freshScope();
		await claimIdempotencyKey(scope);
		await storeIdempotentResponse(scope, { status: 201, body: { proposal: { id: 'p1' } } });

		expect(await claimIdempotencyKey(scope)).toEqual({
			kind: IDEMPOTENCY_CLAIM.replay,
			status: 201,
			body: { proposal: { id: 'p1' } },
		});
		expect(await claimIdempotencyKey({ ...scope, fingerprint: 'request-b' })).toEqual({
			kind: IDEMPOTENCY_CLAIM.reused,
		});
	});

	it('lets a retry take over a key whose request died in progress', async () => {
		const scope = freshScope();
		const claimedAt = new Date();
		await claimIdempotencyKey(scope, claimedAt);

		expect(
			await claimIdempotencyKey(
				scope,
				later(claimedAt, IDEMPOTENCY_KEY_ABANDONED_AFTER_MS - 1000),
			),
		).toEqual({ kind: IDEMPOTENCY_CLAIM.inProgress });
		expect(
			await claimIdempotencyKey(
				scope,
				later(claimedAt, IDEMPOTENCY_KEY_ABANDONED_AFTER_MS + 1000),
			),
		).toEqual({ kind: IDEMPOTENCY_CLAIM.claimed });
	});

	it('replays a stored response for the retention period, then claims the key anew', async () => {
		const scope = freshScope();
		const claimedAt = new Date();
		await claimIdempotencyKey(scope, claimedAt);
		await storeIdempotentResponse(scope, { status: 201, body: null });

		expect(
			await claimIdempotencyKey(scope, later(claimedAt, IDEMPOTENCY_KEY_RETENTION_MS - 1000)),
		).toMatchObject({ kind: IDEMPOTENCY_CLAIM.replay });
		expect(
			await claimIdempotencyKey(
				{ ...scope, fingerprint: 'request-b' },
				later(claimedAt, IDEMPOTENCY_KEY_RETENTION_MS + 1000),
			),
		).toEqual({ kind: IDEMPOTENCY_CLAIM.claimed });
	});

	it('frees a released key for any request', async () => {
		const scope = freshScope();
		await claimIdempotencyKey(scope);

		await releaseIdempotencyKey(scope);

		expect(await claimIdempotencyKey({ ...scope, fingerprint: 'request-b' })).toEqual({
			kind: IDEMPOTENCY_CLAIM.claimed,
		});
	});
});
