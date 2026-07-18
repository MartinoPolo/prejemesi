<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Select from '$lib/components/base/select/index.js';
	import ArrowUpDownIcon from '@lucide/svelte/icons/arrow-up-down';
	import { GIFT_SORT_OPTIONS, type GiftSortOption } from '$lib/modules/gifts/types.js';

	interface GiftSortSelectProps {
		value: GiftSortOption;
		onchange: (sort: GiftSortOption) => void;
	}

	let { value, onchange }: GiftSortSelectProps = $props();

	const SORT_LABELS = {
		ownerOrder: () => m.gift_sort_owner_order(),
		priority: () => m.gift_sort_priority(),
		priceAsc: () => m.gift_sort_price_asc(),
		priceDesc: () => m.gift_sort_price_desc(),
		name: () => m.gift_sort_name(),
		dateAdded: () => m.gift_sort_date_added(),
	} satisfies Record<GiftSortOption, () => string>;

	const SORT_KEYS = Object.keys(GIFT_SORT_OPTIONS) as GiftSortOption[];

	function isGiftSortOption(candidate: string): candidate is GiftSortOption {
		return candidate in GIFT_SORT_OPTIONS;
	}
</script>

<!-- Visible sort select in the wishlist toolbar (issue #101 / #102 REQ-15) -->
<Select.Root
	type="single"
	{value}
	onValueChange={(newValue) => {
		if (isGiftSortOption(newValue)) {
			onchange(newValue);
		}
	}}
>
	<Select.Trigger size="md" aria-label={m.gift_sort_by()}>
		<ArrowUpDownIcon class="size-3.5 text-muted-foreground" />
		<span>{SORT_LABELS[value]()}</span>
	</Select.Trigger>
	<Select.Content>
		<Select.Group>
			{#each SORT_KEYS as option (option)}
				<Select.Item value={option} label={SORT_LABELS[option]()} />
			{/each}
		</Select.Group>
	</Select.Content>
</Select.Root>
