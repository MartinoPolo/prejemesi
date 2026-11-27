<script lang="ts">
	import { onMount } from 'svelte';
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import * as Alert from '$lib/components/base/alert/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import { toastError, toastSuccess } from '$lib/components/base/toast/index.js';
	import { ConfirmDialog } from '$lib/components/derived/confirm-dialog/index.js';
	import { translateServerError } from '$lib/modules/errors/translate_server_error.js';
	import { GIFT_LINK_GROUP_KIND } from '$lib/modules/gifts/gift_link_group_kind.js';
	import {
		deleteGift,
		getGiftShareDestinations,
		getGiftsByWishlistShortId,
		shareGifts,
	} from '$lib/modules/gifts/gifts.remote.js';
	import { useSharedGiftListRecipient } from '$lib/modules/gifts/shared_gift_list_recipient.js';
	import type { GiftByRole, SharedGiftMember } from '$lib/modules/gifts/types.js';
	import * as m from '$lib/paraglide/messages.js';
	import GiftShareListRow from './GiftShareListRow.svelte';

	interface Props {
		/** The edited gift; the field exists only for a saved gift its viewer manages. */
		gift: GiftByRole;
	}

	type ShareDestination = Awaited<ReturnType<typeof getGiftShareDestinations>>[number];

	interface RemovalTarget {
		giftId: string;
		wishlistTitle: string;
	}

	let { gift }: Props = $props();

	const listRecipient = useSharedGiftListRecipient();
	const fieldId = $props.id();
	let destinations = $state.raw<ShareDestination[]>([]);
	let loadFailure = $state<string | null>(null);
	let pendingWishlistId = $state<string | null>(null);
	let removalTarget = $state<RemovalTarget | null>(null);
	let removalOpen = $state(false);

	const thisListRecipient = $derived(listRecipient());
	const linkedToCopies = $derived(
		gift.linkedCopies.length > 0 || gift.linkGroupKind === GIFT_LINK_GROUP_KIND.linkedCopies,
	);
	const visible = $derived(
		gift.sharedWith.length > 0 || destinations.length > 0 || loadFailure !== null,
	);

	async function loadDestinations() {
		loadFailure = null;
		try {
			destinations = await getGiftShareDestinations({ giftIds: [gift.id] });
		} catch (thrown) {
			destinations = [];
			loadFailure = translateServerError(thrown);
		}
	}

	async function addToWishlist(destination: ShareDestination) {
		pendingWishlistId = destination.id;
		try {
			await shareGifts({ giftIds: [gift.id], wishlistIds: [destination.id] }).updates(
				getGiftsByWishlistShortId,
			);
			toastSuccess(m.gift_shared_field_added({ title: destination.title }));
			await loadDestinations();
		} catch (thrown) {
			toastError(translateServerError(thrown));
		} finally {
			pendingWishlistId = null;
		}
	}

	/** Only a list the viewer manages names its gift, so only there can the gift be removed. */
	function removalTargetFor(member: SharedGiftMember): RemovalTarget | null {
		return member.giftId === null || member.wishlistTitle === null
			? null
			: { giftId: member.giftId, wishlistTitle: member.wishlistTitle };
	}

	function changeMember(member: SharedGiftMember, checked: boolean) {
		const target = removalTargetFor(member);
		if (!checked && target !== null) {
			removalTarget = target;
			removalOpen = true;
		}
	}

	function changeDestination(destination: ShareDestination, checked: boolean) {
		if (checked) {
			void addToWishlist(destination);
		}
	}

	async function removeFromWishlist() {
		if (removalTarget === null) {
			return;
		}
		const { giftId, wishlistTitle } = removalTarget;
		try {
			// Every list of the group on screen changes, not only the one the server refreshes.
			await deleteGift(giftId).updates(getGiftsByWishlistShortId);
			toastSuccess(m.gift_shared_field_removed({ title: wishlistTitle }));
			removalOpen = false;
			await loadDestinations();
		} catch (thrown) {
			toastError(translateServerError(thrown));
		}
	}

	onMount(() => {
		void loadDestinations();
	});
</script>

{#snippet listRows()}
	{#if thisListRecipient !== null}
		<GiftShareListRow
			checkboxId="{fieldId}-this"
			checked
			disabled
			locked
			recipientName={thisListRecipient.name}
			recipientImage={thisListRecipient.image}
			wishlistTitle={null}
			note={m.gift_shared_explanation_this_list()}
		/>
	{/if}
	{#each gift.sharedWith as member, index (index)}
		{@const removable = removalTargetFor(member) !== null}
		<GiftShareListRow
			checkboxId="{fieldId}-member-{index}"
			checked
			disabled={!removable || linkedToCopies}
			locked={!removable}
			recipientName={member.recipientDisplayName}
			recipientImage={member.recipientImage}
			wishlistTitle={member.wishlistTitle}
			note={removable ? null : m.gift_shared_field_unmanaged()}
			oncheckedchange={(checked) => changeMember(member, checked)}
		/>
	{/each}
	{#each destinations as destination (destination.id)}
		<GiftShareListRow
			checkboxId="{fieldId}-destination-{destination.id}"
			checked={pendingWishlistId === destination.id}
			disabled={linkedToCopies || pendingWishlistId !== null}
			recipientName={destination.recipientDisplayName}
			recipientImage={destination.recipientImage}
			wishlistTitle={destination.title}
			oncheckedchange={(checked) => changeDestination(destination, checked)}
		/>
	{/each}
{/snippet}

{#if visible}
	<section
		class="grid min-w-0 gap-1.5"
		aria-labelledby="{fieldId}-label"
		data-testid="gift-shared-field"
	>
		<h3 id="{fieldId}-label" class="text-sm font-semibold text-foreground">
			{m.gift_shared_field_label()}
		</h3>
		<div
			class="grid min-w-0 gap-0.5 rounded-badge border-2 border-edge p-1"
			role="group"
			aria-labelledby="{fieldId}-label"
		>
			{@render listRows()}
		</div>
		{#if loadFailure !== null}
			<Alert.Root tone="danger" role="alert">
				<CircleAlertIcon />
				<Alert.Description>{loadFailure}</Alert.Description>
				<div class="col-start-2 pt-2">
					<Button intent="outline" size="sm" onclick={() => void loadDestinations()}>
						<RefreshCwIcon data-icon="inline-start" />{m.dialog_retry()}
					</Button>
				</div>
			</Alert.Root>
		{/if}
		{#if linkedToCopies}
			<HelpText>{m.gift_shared_field_linked_copy()}</HelpText>
		{:else}
			<HelpText>{m.gift_shared_field_help()}</HelpText>
			<HelpText>{m.gift_shared_field_quantity_help()}</HelpText>
		{/if}
	</section>
{/if}

{#if removalTarget !== null}
	<ConfirmDialog
		bind:open={removalOpen}
		title={m.gift_shared_field_remove_title({ title: removalTarget.wishlistTitle })}
		description={m.gift_shared_field_remove_description({ title: removalTarget.wishlistTitle })}
		confirmLabel={m.gift_shared_field_remove_confirm()}
		confirmIntent="primary-destructive"
		onconfirm={removeFromWishlist}
	/>
{/if}
