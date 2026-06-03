<script lang="ts">
	import { Input } from '$lib/components/base/input/index.js';
	import * as Select from '$lib/components/base/select/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import {
		GIFT_CURRENCIES,
		GIFT_CURRENCY_LABELS,
		type GiftCurrency,
	} from '$lib/modules/gifts/types.js';

	interface GiftDraftPriceCellProps {
		price: number | null;
		currency: GiftCurrency;
		disabled?: boolean;
		onpricechange: (price: number | null) => void;
		oncurrencychange: (currency: GiftCurrency) => void;
	}

	let {
		price,
		currency,
		disabled = false,
		onpricechange,
		oncurrencychange,
	}: GiftDraftPriceCellProps = $props();

	const displayPrice = $derived(price !== null ? String(price) : '');

	function handlePriceInput(event: Event) {
		const target = event.target as HTMLInputElement;
		const raw = target.value.trim();
		if (raw === '') {
			onpricechange(null);
			return;
		}
		const parsed = Number(raw);
		if (!Number.isNaN(parsed) && parsed >= 0) {
			onpricechange(Math.round(parsed));
		}
	}
</script>

<div class="flex items-center gap-1">
	<Input
		type="number"
		value={displayPrice}
		placeholder={m.batch_add_price_placeholder()}
		class="h-7 min-w-0 flex-1 text-right text-xs"
		min="0"
		{disabled}
		oninput={handlePriceInput}
	/>
	<Select.Root
		type="single"
		value={currency}
		onValueChange={(value) => {
			if (value !== undefined && value !== '') {
				oncurrencychange(value as GiftCurrency);
			}
		}}
	>
		<Select.Trigger class="h-7 w-[72px] shrink-0 px-2 text-xs" {disabled}>
			{currency}
		</Select.Trigger>
		<Select.Content>
			<Select.Group>
				{#each Object.entries(GIFT_CURRENCIES) as [key, val] (key)}
					<Select.Item value={val} label={GIFT_CURRENCY_LABELS[val]}>
						{GIFT_CURRENCY_LABELS[val]}
					</Select.Item>
				{/each}
			</Select.Group>
		</Select.Content>
	</Select.Root>
</div>
