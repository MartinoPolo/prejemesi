<script lang="ts">
	import * as InputGroup from '$lib/components/base/input-group/index.js';
	import * as Select from '$lib/components/base/select/index.js';
	import { GIFT_CURRENCY_VALUES, type GiftCurrency } from '$lib/modules/gifts/types.js';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		/** Raw price text (whole units only; parsed to an integer by the host). */
		price: string;
		/** Currency code — defaults to CZK upstream. */
		currency: GiftCurrency;
		/** Write a new raw price back to the row. */
		onPriceInput: (value: string) => void;
		/** Write a new currency back to the row. */
		onCurrencyChange: (value: GiftCurrency) => void;
	}

	let { price, currency, onPriceInput, onCurrencyChange }: Props = $props();

	function isCurrency(value: string): value is GiftCurrency {
		return (GIFT_CURRENCY_VALUES as readonly string[]).includes(value);
	}
</script>

<InputGroup.Root class="h-(--size-control-md) bg-surface">
	<InputGroup.Input
		type="text"
		inputmode="numeric"
		value={price}
		oninput={(event) => onPriceInput(event.currentTarget.value)}
		placeholder={m.draft_grid_price_placeholder()}
		aria-label={m.draft_grid_col_price()}
		class="text-right"
	/>
	<InputGroup.Addon align="inline-end" class="p-0">
		<Select.Root
			type="single"
			value={currency}
			onValueChange={(value) => {
				if (isCurrency(value)) {
					onCurrencyChange(value);
				}
			}}
		>
			<Select.Trigger
				size="sm"
				aria-label={m.draft_grid_currency_label()}
				class="h-full rounded-none border-0 border-l border-border-strong bg-surface-2 text-xs font-semibold text-foreground-muted shadow-none"
			>
				{currency}
			</Select.Trigger>
			<Select.Content>
				<Select.Group>
					{#each GIFT_CURRENCY_VALUES as code (code)}
						<Select.Item value={code} label={code}>{code}</Select.Item>
					{/each}
				</Select.Group>
			</Select.Content>
		</Select.Root>
	</InputGroup.Addon>
</InputGroup.Root>
