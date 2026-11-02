import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import {
	FAST_FORWARD_HOLD,
	type PendingChangeProposalSummary,
} from '$lib/modules/change_proposals/types.js';
import PendingChangesBanner from './PendingChangesBanner.svelte';

function pendingProposal(
	overrides: Partial<PendingChangeProposalSummary>,
): PendingChangeProposalSummary {
	return {
		id: 'proposal-1',
		reviewUrl: '/w/bday2026/changes/proposal-1',
		channel: 'token',
		tokenName: 'Claude',
		createdAt: new Date(),
		expiresAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
		rowCount: 26,
		viaApp: false,
		kindCounts: { giftEdit: 26 },
		fastForwardHold: null,
		...overrides,
	};
}

describe('PendingChangesBanner', () => {
	it('says why each fast-forward proposal still waits, and nothing for the others', async () => {
		render(PendingChangesBanner, {
			wishlistShortId: 'bday2026',
			proposals: [
				pendingProposal({ id: 'held', fastForwardHold: FAST_FORWARD_HOLD.failed }),
				pendingProposal({ id: 'reviewed' }),
			],
		});

		const items = page.getByTestId('pending-changes-item');
		await expect
			.element(items.nth(0).getByTestId('pending-changes-hold'))
			.toHaveTextContent(m.fast_forward_hold_failed());
		await expect
			.element(items.nth(1).getByTestId('pending-changes-hold'))
			.not.toBeInTheDocument();
	});

	it('names a connected app as an app and a personal token as a token', async () => {
		render(PendingChangesBanner, {
			wishlistShortId: 'bday2026',
			proposals: [
				pendingProposal({
					id: 'app',
					channel: 'app:claude',
					tokenName: 'Claude',
					viaApp: true,
				}),
				pendingProposal({ id: 'token', tokenName: 'Skript' }),
			],
		});

		const items = page.getByTestId('pending-changes-item');
		await expect.element(items.nth(0)).toHaveTextContent('26 změn přes aplikaci „Claude“');
		await expect.element(items.nth(1)).toHaveTextContent('26 změn přes token „Skript“');
	});
});
