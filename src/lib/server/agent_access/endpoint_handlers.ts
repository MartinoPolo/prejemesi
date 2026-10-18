import { readAccessibleWishlistsOperation } from '$lib/server/operations/wishlist_read_operations.js';
import { agentImageStorage, type AgentImageBucket } from '$lib/server/storage/r2.js';
import type { AuthenticatedAccessToken } from './access_tokens.js';
import { runAgentApiOperation, type AgentApiResponse } from './api.js';
import {
	readChangeProposalForAgent,
	submitChangeProposal,
	submitSingleChangeProposal,
} from './change_proposal_api.js';
import { uploadAgentImage } from './image_upload.js';

/**
 * What each agent endpoint answers, shared by its `/api/v1` route and its MCP tool so both
 * surfaces return the same body for the same call.
 */
export function meResponse(token: AuthenticatedAccessToken): AgentApiResponse {
	return {
		body: {
			user: { name: token.grant.userName },
			token: {
				name: token.grant.tokenName,
				prefix: token.prefix,
				scopes: token.grant.scopes,
				wishlistIds: token.grant.wishlistIds,
				expiresAt: token.expiresAt,
				fastForward: token.fastForward,
			},
		},
	};
}

export async function wishlistsResponse(
	token: AuthenticatedAccessToken,
): Promise<AgentApiResponse> {
	return {
		body: {
			wishlists: await runAgentApiOperation(
				token.grant,
				readAccessibleWishlistsOperation.name,
				{},
			),
		},
	};
}

export async function operationReadResponse(
	token: AuthenticatedAccessToken,
	operationName: string,
	input: unknown,
): Promise<AgentApiResponse> {
	return { body: { result: await runAgentApiOperation(token.grant, operationName, input) } };
}

export async function proposalSubmissionResponse(
	token: AuthenticatedAccessToken,
	body: unknown,
): Promise<AgentApiResponse> {
	return { body: { proposal: await submitChangeProposal(token, body) }, status: 201 };
}

/** One change submitted as a proposal of its own, as MCP change tools do. */
export async function singleChangeSubmissionResponse(
	token: AuthenticatedAccessToken,
	operationName: string,
	input: unknown,
): Promise<AgentApiResponse> {
	return {
		body: { proposal: await submitSingleChangeProposal(token, operationName, input) },
		status: 201,
	};
}

export async function proposalResponse(
	token: AuthenticatedAccessToken,
	proposalId: string,
): Promise<AgentApiResponse> {
	return { body: { proposal: await readChangeProposalForAgent(token, proposalId) } };
}

export async function imageUploadResponse(
	token: AuthenticatedAccessToken,
	body: unknown,
	bucket: AgentImageBucket | undefined,
): Promise<AgentApiResponse> {
	return {
		body: {
			image: await uploadAgentImage(token, body, {
				// The global fetch, not SvelteKit's: the image host is never this app.
				fetch: (url, init) => fetch(url, init),
				storage: bucket && agentImageStorage(bucket),
			}),
		},
		status: 201,
	};
}
