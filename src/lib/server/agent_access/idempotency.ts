import { and, eq, isNull, lt, or } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { agentIdempotencyKey } from '$lib/server/db/change_proposal.schema.js';
import { IDEMPOTENCY_KEY_ABANDONED_AFTER_MS, IDEMPOTENCY_KEY_RETENTION_MS } from './limits.js';

export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';
export const IDEMPOTENCY_KEY_MAX_LENGTH = 255;
/** Printable ASCII without spaces, so any UUID, ULID or random string fits. */
const IDEMPOTENCY_KEY_PATTERN = new RegExp(`^[\\x21-\\x7E]{1,${IDEMPOTENCY_KEY_MAX_LENGTH}}$`);

export const IDEMPOTENCY_CLAIM = {
	/** The caller runs the request and then stores or releases the key. */
	claimed: 'claimed',
	replay: 'replay',
	/** The key was used for a different request. */
	reused: 'reused',
	inProgress: 'inProgress',
} as const;

export type IdempotencyClaim =
	| { kind: typeof IDEMPOTENCY_CLAIM.claimed }
	| { kind: typeof IDEMPOTENCY_CLAIM.replay; status: number; body: unknown }
	| { kind: typeof IDEMPOTENCY_CLAIM.reused }
	| { kind: typeof IDEMPOTENCY_CLAIM.inProgress };

/** One token's key; keys of different tokens never meet. */
export interface IdempotencyScope {
	tokenId: string;
	key: string;
	fingerprint: string;
}

export function isValidIdempotencyKey(key: string): boolean {
	return IDEMPOTENCY_KEY_PATTERN.test(key);
}

/** JSON with object keys sorted, so re-serializing the same request yields the same text. */
function canonicalJson(value: unknown): string {
	if (Array.isArray(value)) {
		return `[${value.map(canonicalJson).join(',')}]`;
	}
	if (typeof value === 'object' && value !== null) {
		const entries = Object.entries(value)
			.filter(([, entryValue]) => entryValue !== undefined)
			.sort(([first], [second]) => (first < second ? -1 : first > second ? 1 : 0));
		return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicalJson(entryValue)}`).join(',')}}`;
	}
	return JSON.stringify(value);
}

/** SHA-256 of the method, path and canonical JSON body. */
export async function fingerprintRequest(
	method: string,
	path: string,
	body: unknown,
): Promise<string> {
	const text = `${method.toUpperCase()}\n${path}\n${canonicalJson(body)}`;
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function keyOf(scope: Pick<IdempotencyScope, 'tokenId' | 'key'>) {
	return and(
		eq(agentIdempotencyKey.tokenId, scope.tokenId),
		eq(agentIdempotencyKey.key, scope.key),
	);
}

/**
 * Claims a key for a request, or reports the stored outcome of its earlier use. An expired key
 * and one whose request died while in progress are taken over as new.
 */
export async function claimIdempotencyKey(
	scope: IdempotencyScope,
	now = new Date(),
): Promise<IdempotencyClaim> {
	const database = getDb();
	const claimedValues = {
		requestFingerprint: scope.fingerprint,
		responseStatus: null,
		responseBody: null,
		createdAt: now,
	};
	// A key purged between the insert and the read is simply claimed on the next attempt.
	for (let attempt = 0; attempt < 2; attempt += 1) {
		const inserted = await database
			.insert(agentIdempotencyKey)
			.values({ tokenId: scope.tokenId, key: scope.key, ...claimedValues })
			.onConflictDoNothing()
			.returning({ key: agentIdempotencyKey.key });
		if (inserted.length > 0) {
			return { kind: IDEMPOTENCY_CLAIM.claimed };
		}
		const takenOver = await database
			.update(agentIdempotencyKey)
			.set(claimedValues)
			.where(
				and(
					keyOf(scope),
					or(
						lt(
							agentIdempotencyKey.createdAt,
							new Date(now.getTime() - IDEMPOTENCY_KEY_RETENTION_MS),
						),
						and(
							isNull(agentIdempotencyKey.responseStatus),
							lt(
								agentIdempotencyKey.createdAt,
								new Date(now.getTime() - IDEMPOTENCY_KEY_ABANDONED_AFTER_MS),
							),
						),
					),
				),
			)
			.returning({ key: agentIdempotencyKey.key });
		if (takenOver.length > 0) {
			return { kind: IDEMPOTENCY_CLAIM.claimed };
		}
		const [existing] = await database.select().from(agentIdempotencyKey).where(keyOf(scope));
		if (existing === undefined) {
			continue;
		}
		if (existing.requestFingerprint !== scope.fingerprint) {
			return { kind: IDEMPOTENCY_CLAIM.reused };
		}
		if (existing.responseStatus === null) {
			return { kind: IDEMPOTENCY_CLAIM.inProgress };
		}
		return {
			kind: IDEMPOTENCY_CLAIM.replay,
			status: existing.responseStatus,
			body: existing.responseBody,
		};
	}
	return { kind: IDEMPOTENCY_CLAIM.inProgress };
}

function claimedBy(scope: IdempotencyScope) {
	return and(
		keyOf(scope),
		eq(agentIdempotencyKey.requestFingerprint, scope.fingerprint),
		isNull(agentIdempotencyKey.responseStatus),
	);
}

/** Stores the response a retry with the same key and request will replay. */
export async function storeIdempotentResponse(
	scope: IdempotencyScope,
	response: { status: number; body: unknown },
): Promise<void> {
	await getDb()
		.update(agentIdempotencyKey)
		.set({ responseStatus: response.status, responseBody: response.body })
		.where(claimedBy(scope));
}

/** Frees the key of a failed request, which changed nothing, so a retry runs it again. */
export async function releaseIdempotencyKey(scope: IdempotencyScope): Promise<void> {
	await getDb().delete(agentIdempotencyKey).where(claimedBy(scope));
}
