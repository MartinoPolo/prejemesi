import { readAccessibleWishlistsOperation } from '$lib/server/operations/wishlist_read_operations.js';
import { agentImageStorage, type AgentImageBucket } from '$lib/server/storage/r2.js';
import { AGENT_CREDENTIAL_KIND, type AgentCaller } from './agent_caller.js';
import { runAgentApiOperation, type AgentApiResponse } from './api.js';
import {
	applyChangeProposalForAgent,
	readChangeProposalForAgent,
	submitChangeProposal,
	submitSingleChangeProposal,
} from './change_proposal_api.js';
import { uploadAgentImage } from './image_upload.js';

/**
 * What each agent endpoint answers, shared by its `/api/v1` route and its MCP tool so both
 * surfaces return the same body for the same call.
 */
export function meResponse({ credential, fastForward, grant }: AgentCaller): AgentApiResponse {
	const access = { name: grant.tokenName, scopes: grant.scopes, wishlistIds: grant.wishlistIds };
	return {
		body: {
			user: { name: grant.userName },
			...(credential.kind === AGENT_CREDENTIAL_KIND.personalAccessToken
				? {
						token: {
							...access,
							prefix: credential.prefix,
							expiresAt: credential.expiresAt,
							fastForward,
						},
					}
				: { app: access }),
		},
	};
}

export async function wishlistsResponse(caller: AgentCaller): Promise<AgentApiResponse> {
	return {
		body: {
			wishlists: await runAgentApiOperation(
				caller.grant,
				readAccessibleWishlistsOperation.name,
				{},
			),
		},
	};
}

export async function operationReadResponse(
	caller: AgentCaller,
	operationName: string,
	input: unknown,
): Promise<AgentApiResponse> {
	return { body: { result: await runAgentApiOperation(caller.grant, operationName, input) } };
}

export async function proposalSubmissionResponse(
	caller: AgentCaller,
	body: unknown,
): Promise<AgentApiResponse> {
	return { body: { proposal: await submitChangeProposal(caller, body) }, status: 201 };
}

/** One change submitted as a proposal of its own, as MCP change tools do. */
export async function singleChangeSubmissionResponse(
	caller: AgentCaller,
	operationName: string,
	input: unknown,
): Promise<AgentApiResponse> {
	return {
		body: { proposal: await submitSingleChangeProposal(caller, operationName, input) },
		status: 201,
	};
}

export async function proposalResponse(
	caller: AgentCaller,
	proposalId: string,
): Promise<AgentApiResponse> {
	return { body: { proposal: await readChangeProposalForAgent(caller, proposalId) } };
}

export async function proposalApplyResponse(
	caller: AgentCaller,
	proposalId: string,
): Promise<AgentApiResponse> {
	return { body: { proposal: await applyChangeProposalForAgent(caller, proposalId) } };
}

export async function imageUploadResponse(
	caller: AgentCaller,
	body: unknown,
	bucket: AgentImageBucket | undefined,
): Promise<AgentApiResponse> {
	return {
		body: {
			image: await uploadAgentImage(caller, body, {
				// The global fetch, not SvelteKit's: the image host is never this app.
				fetch: (url, init) => fetch(url, init),
				storage: bucket && agentImageStorage(bucket),
			}),
		},
		status: 201,
	};
}
