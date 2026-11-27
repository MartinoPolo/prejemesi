<script lang="ts">
	import { untrack } from 'svelte';
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import * as Alert from '$lib/components/base/alert/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import { toastSuccess } from '$lib/components/base/toast/index.js';
	import GiftShareListRow from '$lib/components/blocks/gift/GiftShareListRow.svelte';
	import { translateServerError } from '$lib/modules/errors/translate_server_error.js';
	import { labelForGiftCategory } from '$lib/modules/gift-categories/types.js';
	import {
		getGiftShareDestinations,
		getGiftsByWishlistShortId,
		shareGifts,
	} from '$lib/modules/gifts/gifts.remote.js';
	import { MAX_SHARE_WISHLISTS } from '$lib/modules/gifts/shared_gift.js';
	import type { GiftByRole } from '$lib/modules/gifts/types.js';
	import * as m from '$lib/paraglide/messages.js';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import GiftBulkDialogFrame from './GiftBulkDialogFrame.svelte';

	interface Props {
		open: boolean;
		/** The selected gifts, in display order. */
		gifts: readonly GiftByRole[];
		onopenchange: (open: boolean) => void;
		/** Returns to the mobile bulk actions sheet instead of only closing. */
		onback?: () => void;
	}

	type ShareDestination = Awaited<ReturnType<typeof getGiftShareDestinations>>[number];

	let { open, gifts, onopenchange, onback }: Props = $props();

	const fieldId = $props.id();
	let destinations = $state.raw<ShareDestination[]>([]);
	let selectedWishlistIds = $state.raw<readonly string[]>([]);
	let loading = $state(false);
	let loadFailure = $state<string | null>(null);
	let submitFailure = $state<string | null>(null);
	let submitting = $state(false);

	const giftIds = $derived(gifts.map((gift) => gift.id));
	const categoryNames = $derived.by(() => {
		const language = getLocale().startsWith('en') ? 'en' : 'cs';
		const names = gifts.flatMap((gift) =>
			gift.categories.map((category) => labelForGiftCategory(category, language)),
		);
		return [...new Set(names)];
	});
	const selectionFull = $derived(selectedWishlistIds.length >= MAX_SHARE_WISHLISTS);
	const sharesQuantity = $derived(gifts.some((gift) => gift.quantity !== 1));
	const confirmUnavailable = $derived(
		loading || submitting || loadFailure !== null || selectedWishlistIds.length === 0,
	);

	async function loadDestinations() {
		loading = true;
		loadFailure = null;
		try {
			destinations = await getGiftShareDestinations({ giftIds: [...giftIds] });
		} catch (thrown) {
			destinations = [];
			loadFailure = translateServerError(thrown);
		} finally {
			loading = false;
		}
	}

	function toggleDestination(wishlistId: string, checked: boolean) {
		selectedWishlistIds = checked
			? [...selectedWishlistIds, wishlistId]
			: selectedWishlistIds.filter((selectedId) => selectedId !== wishlistId);
	}

	async function share() {
		submitting = true;
		submitFailure = null;
		try {
			// Every list of each gift lists the new ones, so every gift list on screen refreshes.
			await shareGifts({
				giftIds: [...giftIds],
				wishlistIds: [...selectedWishlistIds],
			}).updates(getGiftsByWishlistShortId);
			toastSuccess(m.gift_bulk_share_success({ count: giftIds.length }));
			onopenchange(false);
		} catch (thrown) {
			submitFailure = translateServerError(thrown);
		} finally {
			submitting = false;
		}
	}

	$effect(() => {
		if (!open) {
			return;
		}
		// Opening loads once; the selection refreshing underneath must not reset the choices.
		untrack(() => {
			selectedWishlistIds = [];
			submitFailure = null;
			void loadDestinations();
		});
	});
</script>

{#snippet failure(message: string, onretry?: () => void)}
	<Alert.Root tone="danger" role="alert">
		<CircleAlertIcon />
		<Alert.Description>{message}</Alert.Description>
		{#if onretry !== undefined}
			<div class="col-start-2 pt-2">
				<Button intent="outline" size="sm" onclick={onretry}>
					<RefreshCwIcon data-icon="inline-start" />{m.dialog_retry()}
				</Button>
			</div>
		{/if}
	</Alert.Root>
{/snippet}

{#snippet body()}
	<div class="grid gap-4 px-4 py-3 sm:px-0 sm:py-4" data-testid="gift-bulk-share">
		{#if loading}
			<p class="text-sm text-muted-foreground">{m.moderator_loading()}</p>
		{:else if loadFailure !== null}
			{@render failure(loadFailure, () => void loadDestinations())}
		{:else if destinations.length === 0}
			<p class="text-sm text-muted-foreground" data-testid="gift-bulk-share-none">
				{m.gift_bulk_share_none()}
			</p>
		{:else}
			<div class="grid gap-1.5">
				<h3 id="{fieldId}-destinations" class="text-sm font-semibold text-foreground">
					{m.gift_bulk_share_destinations()}
				</h3>
				<div
					class="grid max-h-64 min-w-0 gap-0.5 overflow-y-auto rounded-badge border-2 border-edge p-1"
					role="group"
					aria-labelledby="{fieldId}-destinations"
				>
					{#each destinations as destination (destination.id)}
						<GiftShareListRow
							checkboxId="{fieldId}-{destination.id}"
							checked={selectedWishlistIds.includes(destination.id)}
							disabled={submitting ||
								(selectionFull && !selectedWishlistIds.includes(destination.id))}
							recipientName={destination.recipientDisplayName}
							recipientImage={destination.recipientImage}
							wishlistTitle={destination.title}
							oncheckedchange={(checked) =>
								toggleDestination(destination.id, checked)}
						/>
					{/each}
				</div>
			</div>
			<div class="grid gap-1" data-testid="gift-bulk-share-summary">
				{#if sharesQuantity}
					<HelpText>{m.gift_bulk_share_quantity()}</HelpText>
				{/if}
				{#if categoryNames.length > 0}
					<HelpText
						>{m.gift_bulk_share_categories({
							names: categoryNames.join(', '),
						})}</HelpText
					>
				{/if}
			</div>
		{/if}
		{#if submitFailure !== null}
			{@render failure(submitFailure)}
		{/if}
	</div>
{/snippet}

<GiftBulkDialogFrame
	{open}
	{onopenchange}
	title={m.gift_bulk_share_title()}
	description={m.gift_bulk_share_description({ count: giftIds.length })}
	{onback}
	{submitting}
	confirmDisabled={confirmUnavailable}
	confirmLabel={submitting
		? m.gift_bulk_pending({ count: giftIds.length })
		: m.gift_bulk_share_confirm()}
	onconfirm={() => void share()}
>
	{@render body()}
</GiftBulkDialogFrame>
