<script lang="ts">
	import GiftCompactRow from '$lib/components/blocks/gift/GiftCompactRow.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import GiftSectionHeader from './GiftSectionHeader.svelte';
	import { giftSectionHasHeader, type GiftSection } from '$lib/modules/gifts/gift_ordering.js';
	import type { GiftByRole, GiftForVisitor } from '$lib/modules/gifts/types.js';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';

	interface WishlistGiftCompactTableProps {
		sections: GiftSection[];
		role: WishlistRole;
		isArchived: boolean;
		/** Recipient-safe presentation: hide the like/reserve columns and all reservation state. */
		hideReservationState: boolean;
		/** Recipient OR správce: show the drag/edit column + enable click-to-edit. */
		canManage: boolean;
		onedit: (gift: GiftByRole) => void;
		onreserve: (gift: GiftForVisitor) => void;
		onunreserve: (gift: GiftForVisitor) => void;
		onreceived: (giftId: string, received: boolean) => void;
	}

	let {
		sections,
		role,
		isArchived,
		hideReservationState,
		canManage,
		onedit,
		onreserve,
		onunreserve,
		onreceived,
	}: WishlistGiftCompactTableProps = $props();

	const showActions = $derived((canManage && !isArchived) || !hideReservationState);
</script>

<div class="flex flex-col gap-4 overflow-x-auto">
	{#each sections as section (section.key)}
		{#if giftSectionHasHeader(section)}
			<GiftSectionHeader {section} />
		{/if}
		<table class="w-full">
			<thead>
				<tr class="border-b-2 border-border">
					<th
						scope="col"
						class="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
					>
						{m.gift_compact_name_header()}
					</th>
					<th
						scope="col"
						class="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
					>
						{m.gift_compact_link_header()}
					</th>
					<th
						scope="col"
						class="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
					>
						{m.gift_compact_price_header()}
					</th>
					{#if !hideReservationState}
						<th
							scope="col"
							class="px-3 py-2 text-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
						>
							{m.gift_compact_likes_header()}
						</th>
					{/if}
					{#if showActions}
						<th
							scope="col"
							class="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
						>
							{m.gift_compact_actions_header()}
						</th>
					{/if}
				</tr>
			</thead>
			<tbody>
				{#each section.gifts as giftItem (giftItem.id)}
					<GiftCompactRow
						gift={giftItem}
						{role}
						{isArchived}
						{hideReservationState}
						onclick={() => onedit(giftItem)}
						{onreserve}
						{onunreserve}
						{onreceived}
					/>
				{/each}
			</tbody>
		</table>
	{/each}
</div>
