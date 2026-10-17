import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MAX_OPERATION_BATCH_STEPS } from '$lib/server/operations/constants.js';
import { CHANGE_PROPOSAL_MAX_ROWS } from '$lib/modules/change_proposals/types.js';
import { AGENT_API_RATE_LIMIT, AGENT_BATCH_MAX_ITEMS } from './limits.js';

interface RateLimitBinding {
	name: string;
	namespace_id: string;
	simple: { limit: number; period: number };
}

/** `wrangler.jsonc` with its whole-line comments and trailing commas removed. */
function readWranglerConfig(): { ratelimits: RateLimitBinding[] } {
	const jsonc = readFileSync(new URL('../../../../wrangler.jsonc', import.meta.url), 'utf8');
	const json = jsonc
		.split('\n')
		.filter((line) => !line.trim().startsWith('//'))
		.join('\n')
		.replace(/,(\s*[}\]])/g, '$1');
	return JSON.parse(json);
}

describe('agent API limits', () => {
	it('configures the per-token request limit binding exactly as the constants state', () => {
		const bindings = readWranglerConfig().ratelimits;
		const agentBinding = bindings.find((binding) => binding.name === 'AGENT_API_RATE_LIMIT');
		expect(agentBinding?.simple).toEqual({
			limit: AGENT_API_RATE_LIMIT.requestsPerToken,
			period: AGENT_API_RATE_LIMIT.periodSeconds,
		});
		const namespaceIds = bindings.map((binding) => binding.namespace_id);
		expect(new Set(namespaceIds).size).toBe(namespaceIds.length);
	});

	it('caps a batch at 200 items, the operation core’s own cap', () => {
		expect(AGENT_BATCH_MAX_ITEMS).toBe(200);
		expect(AGENT_BATCH_MAX_ITEMS).toBe(MAX_OPERATION_BATCH_STEPS);
	});

	it('lets a reviewer select every row a proposal can hold', () => {
		expect(CHANGE_PROPOSAL_MAX_ROWS).toBe(AGENT_BATCH_MAX_ITEMS);
	});
});
