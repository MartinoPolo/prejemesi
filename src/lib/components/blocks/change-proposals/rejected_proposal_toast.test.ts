import { describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import { showToast, toastError } from '$lib/components/base/toast/index.js';
import { showRejectedProposalToast } from './rejected_proposal_toast.js';

vi.mock('$lib/components/base/toast/index.js', () => ({
	showToast: vi.fn(),
	toastError: vi.fn(),
}));

function pressVrátit() {
	const [options] = vi.mocked(showToast).mock.calls.at(-1) ?? [];
	options?.onAction?.();
}

describe('showRejectedProposalToast', () => {
	it('confirms the rejection and restores the proposal from Vrátit', () => {
		const restore = vi.fn().mockResolvedValue(undefined);

		showRejectedProposalToast(restore);

		expect(showToast).toHaveBeenLastCalledWith(
			expect.objectContaining({
				title: m.change_review_rejected_toast(),
				actionLabel: m.change_review_rejected_undo(),
			}),
		);
		expect(restore).not.toHaveBeenCalled();
		pressVrátit();
		expect(restore).toHaveBeenCalledTimes(1);
	});

	it('reports a restore that fails', async () => {
		vi.mocked(toastError).mockClear();
		showRejectedProposalToast(() => Promise.reject(new Error('offline')));

		pressVrátit();

		await vi.waitFor(() => {
			expect(toastError).toHaveBeenCalledWith(m.change_review_restore_error());
		});
	});
});
