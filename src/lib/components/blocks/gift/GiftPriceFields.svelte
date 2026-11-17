<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils.js';
	import * as Select from '$lib/components/base/select/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import { Input } from '$lib/components/base/input/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import { textLinkVariants } from '$lib/components/base/text-link/index.js';
	import { adjustGiftPriceByMagnitude } from '$lib/modules/gifts/gift_display.js';
	import {
		GIFT_CURRENCIES,
		GIFT_CURRENCY_LABELS,
		type GiftCurrency,
	} from '$lib/modules/gifts/types.js';

	interface Props {
		price: number | null;
		priceMax: number | null;
		/** A range keeps both bounds; a single price drops the upper one on save. */
		isPriceRange: boolean;
		currency: GiftCurrency;
		rangeError: string;
		/** Classes for each field cell, so the parent row lays them out with its other fields. */
		fieldClass: string;
		labelRowClass: string;
	}

	let {
		price = $bindable(),
		priceMax = $bindable(),
		isPriceRange = $bindable(),
		currency = $bindable(),
		rangeError = $bindable(),
		fieldClass,
		labelRowClass,
	}: Props = $props();

	const RANGE_ERROR_ID = 'gift-price-range-error';

	let priceInput = $state<HTMLInputElement | null>(null);
	let priceMaxInput = $state<HTMLInputElement | null>(null);
	const hasRangeError = $derived(rangeError !== '');

	function toggleRange() {
		isPriceRange = !isPriceRange;
		rangeError = '';
	}

	function handlePriceKeydown(
		event: KeyboardEvent,
		currentPrice: number | null,
		setPrice: (value: number) => void,
	): void {
		if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
			return;
		}
		event.preventDefault();
		setPrice(adjustGiftPriceByMagnitude(currentPrice, event.key === 'ArrowUp' ? 1 : -1));
	}

	// Svelte attaches inline `onwheel` as a passive listener, so `preventDefault()`
	// would be ignored and the dialog would scroll while changing price. Register non-passive.
	function priceWheel(
		node: HTMLInputElement,
		getPrice: () => number | null,
		setPrice: (value: number) => void,
	) {
		const listener = (event: WheelEvent) => {
			if (node !== document.activeElement || event.deltaY === 0) {
				return;
			}
			event.preventDefault();
			setPrice(adjustGiftPriceByMagnitude(getPrice(), event.deltaY < 0 ? 1 : -1));
		};
		node.addEventListener('wheel', listener, { passive: false });
		return () => node.removeEventListener('wheel', listener);
	}

	$effect(() => {
		if (priceInput !== null) {
			return priceWheel(
				priceInput,
				() => price,
				(value) => (price = value),
			);
		}
	});

	$effect(() => {
		if (priceMaxInput !== null) {
			return priceWheel(
				priceMaxInput,
				() => priceMax,
				(value) => (priceMax = value),
			);
		}
	});
</script>

{#snippet minPriceInput(ranged: boolean)}
	{@const showsRangeError = ranged && hasRangeError}
	<Input
		id="gift-price"
		class={cn('numeric-input', ranged && 'min-w-0')}
		bind:value={price}
		placeholder="0"
		type="number"
		min="0"
		step="0.01"
		onkeydown={(event) => handlePriceKeydown(event, price, (value) => (price = value))}
		bind:ref={priceInput}
		aria-label={ranged ? m.gift_price_range_min_aria() : undefined}
		state={showsRangeError ? 'error' : 'default'}
		aria-invalid={showsRangeError ? true : undefined}
		aria-describedby={showsRangeError ? RANGE_ERROR_ID : undefined}
	/>
{/snippet}

{#snippet rangeInputs()}
	<div class="flex items-center gap-1.5">
		{@render minPriceInput(true)}
		<span class="shrink-0 text-muted-foreground" aria-hidden="true">–</span>
		<Input
			id="gift-price-max"
			class="numeric-input min-w-0"
			bind:value={priceMax}
			placeholder="0"
			type="number"
			min="0"
			step="0.01"
			onkeydown={(event) =>
				handlePriceKeydown(event, priceMax, (value) => (priceMax = value))}
			bind:ref={priceMaxInput}
			aria-label={m.gift_price_range_max_aria()}
			state={hasRangeError ? 'error' : 'default'}
			aria-invalid={hasRangeError ? true : undefined}
			aria-describedby={hasRangeError ? RANGE_ERROR_ID : undefined}
		/>
	</div>
{/snippet}

<div class={fieldClass} data-testid="gift-price-field">
	<div class={labelRowClass}>
		<Label for="gift-price">{m.gift_price_label()}</Label>
		<button
			type="button"
			class={textLinkVariants({ size: 'sm' }).root()}
			aria-pressed={isPriceRange}
			onclick={toggleRange}
			data-testid="gift-price-range-toggle"
		>
			{m.gift_price_range_link()}
		</button>
	</div>
	<div class="flex min-w-0 flex-col gap-1.5">
		{#if isPriceRange}
			{@render rangeInputs()}
		{:else}
			{@render minPriceInput(false)}
		{/if}
		{#if hasRangeError}
			<HelpText id={RANGE_ERROR_ID} state="error">{rangeError}</HelpText>
		{/if}
	</div>
</div>

<div class={fieldClass}>
	<div class={labelRowClass}>
		<Label for="gift-currency">{m.gift_currency_label()}</Label>
	</div>
	<Select.Root type="single" bind:value={currency}>
		<Select.Trigger id="gift-currency" class="w-full">
			{GIFT_CURRENCY_LABELS[currency]}
		</Select.Trigger>
		<Select.Content>
			<Select.Group>
				{#each Object.values(GIFT_CURRENCIES) as value (value)}
					<Select.Item {value} label={GIFT_CURRENCY_LABELS[value]}>
						{GIFT_CURRENCY_LABELS[value]}
					</Select.Item>
				{/each}
			</Select.Group>
		</Select.Content>
	</Select.Root>
</div>
