import { error, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getActiveLocaleForUrl, getLocalizedAuthHref } from '$lib/i18n/locale.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { requireOwnChangeProposal } from '$lib/server/agent_access/change_proposals.js';
import type { PageServerLoad } from './$types';

/**
 * The wishlist group lets anonymous visitors through, but a review page belongs to the
 * proposal's submitter alone: anyone else gets the same 404 as a missing proposal.
 */
export const load: PageServerLoad = async ({ locals, params, url }) => {
	if (locals.user == null) {
		redirect(
			303,
			getLocalizedAuthHref(
				resolve('/login'),
				url.pathname + url.search,
				getActiveLocaleForUrl(url),
			),
		);
	}
	const record = await requireOwnChangeProposal(locals.user.id, params.proposalId);
	if (record.wishlistShortId !== params.id) {
		error(404, SERVER_ERROR.AGENT_PROPOSAL_NOT_FOUND);
	}
	return {};
};
