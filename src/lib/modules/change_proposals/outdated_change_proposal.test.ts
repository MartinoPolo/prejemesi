import { describe, expect, it } from 'vitest';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { isOutdatedChangeProposalError } from './outdated_change_proposal.js';

/** How a refused remote command reaches the browser: an HTTP error whose body names the code. */
function remoteError(status: number, code: string) {
	return { status, body: { message: code } };
}

describe('isOutdatedChangeProposalError', () => {
	it('recognises a proposal already decided, undone or expired elsewhere', () => {
		expect(
			isOutdatedChangeProposalError(
				remoteError(409, SERVER_ERROR.AGENT_PROPOSAL_NOT_PENDING),
			),
		).toBe(true);
		expect(
			isOutdatedChangeProposalError(remoteError(410, SERVER_ERROR.AGENT_PROPOSAL_EXPIRED)),
		).toBe(true);
		expect(
			isOutdatedChangeProposalError(
				remoteError(409, SERVER_ERROR.AGENT_PROPOSAL_NOT_APPLIED),
			),
		).toBe(true);
	});

	it('leaves other failures to the ordinary error message', () => {
		expect(
			isOutdatedChangeProposalError(
				remoteError(409, SERVER_ERROR.AGENT_PROPOSAL_UNDO_UNSUPPORTED),
			),
		).toBe(false);
		expect(isOutdatedChangeProposalError(new Error('Network down'))).toBe(false);
		expect(isOutdatedChangeProposalError(undefined)).toBe(false);
	});
});
