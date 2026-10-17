import type { RequestHandler } from './$types.js';
import { agentApiEndpoint } from '$lib/server/agent_access/api.js';
import { readChangeProposalForAgent } from '$lib/server/agent_access/change_proposal_api.js';

export const GET: RequestHandler = agentApiEndpoint(async ({ token }, { params }) => ({
	body: { proposal: await readChangeProposalForAgent(token, params.proposalId) },
}));
