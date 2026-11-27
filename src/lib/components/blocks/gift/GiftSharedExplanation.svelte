<script lang="ts">
	import HashIcon from '@lucide/svelte/icons/hash';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ListIcon from '@lucide/svelte/icons/list';
	import { resolve } from '$app/paths';
	import Avatar from '$lib/components/derived/avatar/Avatar.svelte';
	import { localizeInternalHref } from '$lib/i18n/locale.js';
	import { giftCarriesReservationState } from '$lib/modules/gifts/shared_gift.js';
	import {
		SHARED_GIFT_AUDIENCE,
		sharedGiftAudience,
		sharedGiftExplanationText,
		sharedGiftQuantityText,
	} from '$lib/modules/gifts/shared_gift_copy.js';
	import { useSharedGiftListRecipient } from '$lib/modules/gifts/shared_gift_list_recipient.js';
	import type { GiftByRole } from '$lib/modules/gifts/types.js';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';
	import * as m from '$lib/paraglide/messages.js';
	import { getInitials } from '$lib/utils/initials.js';

	interface Props {
		gift: GiftByRole;
		role: WishlistRole;
	}

	let { gift, role }: Props = $props();

	const listRecipient = useSharedGiftListRecipient();

	const audience = $derived(sharedGiftAudience(gift, role));
	const thisListRecipient = $derived(listRecipient());
	const participants = $derived([
		...(thisListRecipient === null ? [] : [{ ...thisListRecipient, thisList: true }]),
		...gift.sharedWith.map((member) => ({
			name: member.recipientDisplayName,
			image: member.recipientImage,
			thisList: false,
		})),
	]);
	const otherNames = $derived(gift.sharedWith.map((member) => member.recipientDisplayName));
	const participantNames = $derived(participants.map((participant) => participant.name));
	const explanation = $derived(sharedGiftExplanationText(audience, participantNames, otherNames));
	const quantityText = $derived(
		sharedGiftQuantityText(gift.quantity, participants.length, audience),
	);
	const reservedProgress = $derived.by(() => {
		if (
			audience !== SHARED_GIFT_AUDIENCE.gifter ||
			!giftCarriesReservationState(gift) ||
			gift.quantity === null ||
			(gift.quantity === 1 && gift.reservedCount === 0)
		) {
			return null;
		}
		return { reserved: Math.min(gift.reservedCount, gift.quantity), total: gift.quantity };
	});
	const openableLists = $derived(
		gift.sharedWith.flatMap((member) =>
			member.wishlistShortId === null || member.wishlistTitle === null
				? []
				: [{ shortId: member.wishlistShortId, title: member.wishlistTitle }],
		),
	);

	function wishlistHref(shortId: string): string {
		return localizeInternalHref(resolve('/(app)/w/[id]', { id: shortId }));
	}
</script>

<ul
	class="m-0 flex list-none flex-wrap gap-x-3 gap-y-2 p-0"
	aria-label={m.gift_shared_explanation_people()}
	data-testid="gift-shared-explanation-people"
>
	{#each participants as participant, index (index)}
		<li class="flex min-w-0 items-center gap-1.5 text-sm font-semibold">
			<Avatar
				appearance="recipient"
				src={participant.image}
				alt=""
				initials={getInitials(participant.name)}
			/>
			<span class="truncate">{participant.name}</span>
			{#if participant.thisList}
				<span class="text-xs font-normal text-muted-foreground"
					>{m.gift_shared_explanation_this_list()}</span
				>
			{/if}
		</li>
	{/each}
</ul>
<p class="text-sm text-foreground" data-testid="gift-shared-explanation-text">{explanation}</p>
<div class="grid gap-1.5 text-sm">
	<p class="flex items-start gap-2" data-testid="gift-shared-explanation-quantity">
		<HashIcon class="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
		<span>{quantityText}</span>
	</p>
	{#if reservedProgress !== null}
		<p class="flex items-start gap-2" data-testid="gift-shared-explanation-progress">
			<CheckIcon class="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
			<span
				>{m.gift_shared_reserved_progress({
					reserved: reservedProgress.reserved,
					count: reservedProgress.total,
				})}</span
			>
		</p>
	{/if}
</div>
{#if openableLists.length > 0}
	<p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" data-testid="gift-shared-lists">
		<ListIcon class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
		<span>{m.gift_shared_other_lists()}</span>
		{#each openableLists as list (list.shortId)}
			<a
				class="font-semibold text-brand-link underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
				href={wishlistHref(list.shortId)}>{list.title}</a
			>
		{/each}
	</p>
{/if}
