<script lang="ts">
	import GiftCompactRow from '$lib/components/blocks/gift/GiftCompactRow.svelte';
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
	}: WishlistGiftCompactTableProps = $props();
</script>

<div class="flex flex-col gap-4 overflow-x-auto">
	{#each sections as section, sectionIndex (`${section.kind}-${section.label ?? ''}-${sectionIndex}`)}
		{#if giftSectionHasHeader(section)}
			<GiftSectionHeader {section} />
		{/if}
		<table class="w-full">
			<thead>
				<tr class="border-b-2 border-border">
					{#if canManage}
						<th class="w-8 px-1"></th>
					{/if}
					<th
						class="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
					>
						Nazev
					</th>
					<th
						class="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
					>
						Odkaz
					</th>
					<th
						class="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
					>
						Cena
					</th>
					{#if !hideReservationState}
						<th
							class="px-3 py-2 text-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
						>
							&#9825;
						</th>
						<th
							class="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
						>
							Akce
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
					/>
				{/each}
			</tbody>
		</table>
	{/each}
</div>
