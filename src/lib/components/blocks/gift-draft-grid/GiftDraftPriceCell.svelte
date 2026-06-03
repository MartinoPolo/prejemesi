<script lang="ts">
	import * as InputGroup from '$lib/components/base/input-group/index.js';
	import type { GiftCurrency } from '$lib/modules/gifts/types.js';
	import { GIFT_CURRENCIES, GIFT_CURRENCY_LABELS } from '$lib/modules/gifts/types.js';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		price: number | null;
		currency: GiftCurrency;
		onPriceChange: (price: number | null) => void;
		onCurrencyChange: (currency: GiftCurrency) => void;
		disabled?: boolean;
	}

	let { price, currency, onPriceChange, onCurrencyChange, disabled = false }: Props = $props();

	function handlePriceInput(event: Event) {
		const target = event.target as HTMLInputElement;
		const raw = target.value.trim();
		if (raw === '') {
			onPriceChange(null);
			return;
		}
		const parsed = Number(raw);
		if (!Number.isNaN(parsed) && parsed >= 0) {
			onPriceChange(Math.round(parsed));
		}
	}

	function handleCurrencyChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		const value = target.value as GiftCurrency;
		if (value in GIFT_CURRENCIES) {
			onCurrencyChange(value);
		}
	}
</script>

<InputGroup.Root class="w-full">
	<InputGroup.Input
		type="text"
		inputmode="numeric"
		value={price !== null ? String(price) : ''}
		oninput={handlePriceInput}
		placeholder={m.draft_grid_price_placeholder()}
		class="text-right"
		{disabled}
		aria-label={m.draft_grid_column_price()}
	/>
	<select
		class="h-full border-0 border-l border-border bg-surface-2 px-2 text-sm font-medium outline-none"
		value={currency}
		onchange={handleCurrencyChange}
		{disabled}
		aria-label={m.draft_grid_currency_label()}
	>
		{#each Object.entries(GIFT_CURRENCY_LABELS) as [key, label] (key)}
			<option value={key}>{label}</option>
		{/each}
	</select>
</InputGroup.Root>
