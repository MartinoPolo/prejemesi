<script lang="ts">
	import GiftCompactRow from '$lib/components/blocks/gift/GiftCompactRow.svelte';
	import type { GiftByRole, GiftForVisitor } from '$lib/modules/gifts/types.js';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';

	interface WishlistGiftCompactTableProps {
		gifts: GiftByRole[];
		role: WishlistRole;
		isArchived: boolean;
		isOwner: boolean;
		isOwnerOrModerator: boolean;
		onedit: (gift: GiftByRole) => void;
		onreserve: (gift: GiftForVisitor) => void;
	}

	let {
		gifts,
		role,
		isArchived,
		isOwner,
		isOwnerOrModerator,
		onedit,
		onreserve,
	}: WishlistGiftCompactTableProps = $props();
</script>

<div class="overflow-x-auto">
	<table class="w-full">
		<thead>
			<tr class="border-b-2 border-border">
				{#if isOwnerOrModerator}
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
				{#if !isOwner}
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
			{#each gifts as giftItem (giftItem.id)}
				<GiftCompactRow
					gift={giftItem}
					{role}
					{isArchived}
					onclick={() => {
						if (isOwnerOrModerator) onedit(giftItem);
					}}
					{onreserve}
				/>
			{/each}
		</tbody>
	</table>
</div>
