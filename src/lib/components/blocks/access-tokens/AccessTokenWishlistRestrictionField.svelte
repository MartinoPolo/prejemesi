<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as RadioGroup from '$lib/components/base/radio-group/index.js';
	import { choiceRowVariants } from '$lib/components/derived/choice-row/index.js';
	import { cn } from '$lib/utils.js';
	import AccessTokenWishlistPicker from './AccessTokenWishlistPicker.svelte';
	import { WISHLIST_RESTRICTION, type WishlistRestriction } from './access_token_form.js';

	interface AccessTokenWishlistRestrictionFieldProps {
		restriction: WishlistRestriction;
		selectedWishlistIds: string[];
		wishlistSearch: string;
		/** Set when the restriction names no wishlist; picking one clears it. */
		wishlistsError: boolean;
	}

	let {
		restriction = $bindable(),
		selectedWishlistIds = $bindable(),
		wishlistSearch = $bindable(),
		wishlistsError = $bindable(),
	}: AccessTokenWishlistRestrictionFieldProps = $props();

	const idPrefix = $props.id();

	const restrictionOptions = [
		{ value: WISHLIST_RESTRICTION.all, label: m.access_tokens_lists_option_all },
		{ value: WISHLIST_RESTRICTION.some, label: m.access_tokens_lists_option_some },
	];
</script>

<fieldset class="flex min-w-0 flex-col gap-1.5">
	<legend class="mb-1.5 text-(length:--text-sm) font-semibold">
		{m.access_tokens_lists_label()}
	</legend>
	<RadioGroup.Root
		bind:value={
			() => restriction,
			(next) => {
				restriction =
					next === WISHLIST_RESTRICTION.some
						? WISHLIST_RESTRICTION.some
						: WISHLIST_RESTRICTION.all;
				wishlistsError = false;
			}
		}
		class="flex flex-col gap-0.5"
	>
		{#each restrictionOptions as option (option.value)}
			<label
				for="{idPrefix}-restriction-{option.value}"
				class={cn(
					choiceRowVariants({ selected: restriction === option.value }),
					'gap-2.5 px-2.5 py-2 text-(length:--text-md)',
				)}
			>
				<RadioGroup.Item id="{idPrefix}-restriction-{option.value}" value={option.value} />
				<span data-slot="choice-row-label">{option.label()}</span>
			</label>
		{/each}
	</RadioGroup.Root>

	{#if restriction === WISHLIST_RESTRICTION.some}
		<AccessTokenWishlistPicker
			bind:selectedIds={selectedWishlistIds}
			bind:search={wishlistSearch}
			bind:missingSelection={wishlistsError}
		/>
	{/if}
</fieldset>
