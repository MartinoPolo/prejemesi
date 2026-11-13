import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { getServerErrorCode } from '$lib/modules/errors/translate_server_error.js';

const OUTDATED_PROPOSAL_CODES: ReadonlySet<string> = new Set([
	SERVER_ERROR.AGENT_PROPOSAL_NOT_PENDING,
	SERVER_ERROR.AGENT_PROPOSAL_EXPIRED,
	SERVER_ERROR.AGENT_PROPOSAL_NOT_APPLIED,
]);

/**
 * The action acted on an outdated copy: the proposal was decided, undone or expired elsewhere,
 * such as on its review page or in another tab, so the surface should load its real state.
 */
export function isOutdatedChangeProposalError(thrown: unknown): boolean {
	const code = getServerErrorCode(thrown);
	return code !== null && OUTDATED_PROPOSAL_CODES.has(code);
}
