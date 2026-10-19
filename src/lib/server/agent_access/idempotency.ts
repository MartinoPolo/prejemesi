import { and, eq, isNull, lt, or } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import {
	agentIdempotencyKey,
	agentOauthIdempotencyKey,
} from '$lib/server/db/change_proposal.schema.js';
import { AGENT_CREDENTIAL_KIND, type AgentCredential } from './agent_caller.js';
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

/** One credential's key; keys of different credentials never meet. */
export interface IdempotencyScope {
	credential: AgentCredential;
	key: string;
	fingerprint: string;
}

/** Tokens and grants keep their keys in tables of the same shape, each cascading with its owner. */
function keyTableOf(credential: AgentCredential) {
	return credential.kind === AGENT_CREDENTIAL_KIND.personalAccessToken
		? { table: agentIdempotencyKey, ownerColumn: agentIdempotencyKey.tokenId }
		: { table: agentOauthIdempotencyKey, ownerColumn: agentOauthIdempotencyKey.grantId };
}

function insertClaim(
	scope: IdempotencyScope,
	values: { requestFingerprint: string; createdAt: Date },
) {
	const database = getDb();
	const { credential, key } = scope;
	return credential.kind === AGENT_CREDENTIAL_KIND.personalAccessToken
		? database
				.insert(agentIdempotencyKey)
				.values({ tokenId: credential.id, key, ...values })
				.onConflictDoNothing()
				.returning({ key: agentIdempotencyKey.key })
		: database
				.insert(agentOauthIdempotencyKey)
				.values({ grantId: credential.id, key, ...values })
				.onConflictDoNothing()
				.returning({ key: agentOauthIdempotencyKey.key });
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

function keyOf(scope: Pick<IdempotencyScope, 'credential' | 'key'>) {
	const { table, ownerColumn } = keyTableOf(scope.credential);
	return and(eq(ownerColumn, scope.credential.id), eq(table.key, scope.key));
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
	const { table } = keyTableOf(scope.credential);
	const claimedValues = {
		requestFingerprint: scope.fingerprint,
		responseStatus: null,
		responseBody: null,
		createdAt: now,
	};
	// A key purged between the insert and the read is simply claimed on the next attempt.
	for (let attempt = 0; attempt < 2; attempt += 1) {
		const inserted = await insertClaim(scope, claimedValues);
		if (inserted.length > 0) {
			return { kind: IDEMPOTENCY_CLAIM.claimed };
		}
		const takenOver = await database
			.update(table)
			.set(claimedValues)
			.where(
				and(
					keyOf(scope),
					or(
						lt(table.createdAt, new Date(now.getTime() - IDEMPOTENCY_KEY_RETENTION_MS)),
						and(
							isNull(table.responseStatus),
							lt(
								table.createdAt,
								new Date(now.getTime() - IDEMPOTENCY_KEY_ABANDONED_AFTER_MS),
							),
						),
					),
				),
			)
			.returning({ key: table.key });
		if (takenOver.length > 0) {
			return { kind: IDEMPOTENCY_CLAIM.claimed };
		}
		const [existing] = await database
			.select({
				requestFingerprint: table.requestFingerprint,
				responseStatus: table.responseStatus,
				responseBody: table.responseBody,
			})
			.from(table)
			.where(keyOf(scope));
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
	const { table } = keyTableOf(scope.credential);
	return and(
		keyOf(scope),
		eq(table.requestFingerprint, scope.fingerprint),
		isNull(table.responseStatus),
	);
}

/** Stores the response a retry with the same key and request will replay. */
export async function storeIdempotentResponse(
	scope: IdempotencyScope,
	response: { status: number; body: unknown },
): Promise<void> {
	await getDb()
		.update(keyTableOf(scope.credential).table)
		.set({ responseStatus: response.status, responseBody: response.body })
		.where(claimedBy(scope));
}

/** Frees the key of a failed request, which changed nothing, so a retry runs it again. */
export async function releaseIdempotencyKey(scope: IdempotencyScope): Promise<void> {
	await getDb().delete(keyTableOf(scope.credential).table).where(claimedBy(scope));
}
