import * as m from '$lib/paraglide/messages.js';
import { showToast, toastError } from '$lib/components/base/toast/index.js';
import { translateServerError } from '$lib/modules/errors/translate_server_error.js';

/**
 * Confirms a rejected proposal with a Vrátit action that makes it pending again, so rejecting
 * applies in one click without a confirmation dialog.
 */
export function showRejectedProposalToast(restore: () => Promise<unknown>): void {
	showToast({
		tone: 'success',
		title: m.change_review_rejected_toast(),
		actionLabel: m.change_review_rejected_undo(),
		onAction: () => {
			restore().catch((error: unknown) => {
				toastError(translateServerError(error, m.change_review_restore_error()));
			});
		},
	});
}
