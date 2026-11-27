<script lang="ts">
	import { toastError, toastSuccess } from '$lib/components/base/toast/index.js';
	import { ConfirmDialog } from '$lib/components/derived/confirm-dialog/index.js';
	import { translateServerError } from '$lib/modules/errors/translate_server_error.js';
	import { getGiftsByWishlistShortId, unlinkGift } from '$lib/modules/gifts/gifts.remote.js';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		open?: boolean;
		/** The copy that leaves its link group. */
		giftId: string;
		/** Title of the list whose copy stops synchronizing. */
		wishlistTitle: string;
	}

	let { open = $bindable(false), giftId, wishlistTitle }: Props = $props();

	async function unlink() {
		try {
			// Every gift list on screen shows the group, so each active query refreshes, not only
			// the unlinked copy's list the server refreshes.
			await unlinkGift({ giftId }).updates(getGiftsByWishlistShortId);
			toastSuccess(m.gift_unlink_success());
			open = false;
		} catch (thrown) {
			toastError(translateServerError(thrown, m.gift_unlink_error()));
		}
	}
</script>

<ConfirmDialog
	bind:open
	title={m.gift_unlink_confirm_title()}
	description={m.gift_unlink_confirm_description({ title: wishlistTitle })}
	confirmLabel={m.gift_unlink_button()}
	confirmIntent="primary-destructive"
	pendingLabel={m.gift_unlink_pending()}
	onconfirm={unlink}
/>
