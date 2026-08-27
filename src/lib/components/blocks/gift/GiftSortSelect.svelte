<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Select from '$lib/components/base/select/index.js';
	import { OUTLINE_CONTROL_SURFACE_CLASSES } from '$lib/components/base/button/button_variants.js';
	import ArrowUpDownIcon from '@lucide/svelte/icons/arrow-up-down';
	import { GIFT_SORT_OPTIONS, type GiftSortOption } from '$lib/modules/gifts/types.js';
	import { cn } from '$lib/utils.js';

	interface GiftSortSelectProps {
		value: GiftSortOption;
		onchange: (sort: GiftSortOption) => void;
		open?: boolean;
		onopenchange?: (open: boolean) => void;
		class?: string;
	}

	let {
		value,
		onchange,
		open = false,
		onopenchange,
		class: className,
	}: GiftSortSelectProps = $props();

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

	const combinedLabel = $derived(`${m.gift_sort_by()}: ${SORT_LABELS[value]()}`);
</script>

<!-- Visible sort select in the wishlist toolbar (issue #101 / #102 REQ-15) -->
<Select.Root
	type="single"
	{value}
	{open}
	onOpenChange={onopenchange}
	onValueChange={(newValue) => {
		if (isGiftSortOption(newValue)) {
			onchange(newValue);
		}
	}}
>
	<Select.Trigger
		size="md"
		class={cn('min-w-0 max-w-full px-3', OUTLINE_CONTROL_SURFACE_CLASSES, className)}
		aria-label={combinedLabel}
		title={combinedLabel}
	>
		<ArrowUpDownIcon class="size-4 shrink-0 text-muted-foreground" data-toolbar-icon="sort" />
		<span class="min-w-0 truncate">{SORT_LABELS[value]()}</span>
	</Select.Trigger>
	<Select.Content preventScroll={false}>
		<Select.Group>
			{#each SORT_KEYS as option (option)}
				<Select.Item value={option} label={SORT_LABELS[option]()} />
			{/each}
		</Select.Group>
	</Select.Content>
</Select.Root>
