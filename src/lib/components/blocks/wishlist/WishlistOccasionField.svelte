<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import * as ToggleGroup from '$lib/components/base/toggle-group/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import {
		WISHLIST_OCCASION,
		WISHLIST_OCCASIONS,
		type WishlistOccasion,
	} from '$lib/modules/wishlists/types.js';
	import { WISHLIST_OCCASION_DISPLAY } from '$lib/modules/wishlists/wishlist_occasion_display.js';

	interface WishlistOccasionFieldProps {
		/** Prefix for the label/help ids, unique per surface. */
		id: string;
		value: WishlistOccasion;
		onvaluechange: (occasion: WishlistOccasion) => void;
		disabled?: boolean;
		/** The server rejects making an occasion wishlist with an upcoming event date permanent. */
		permanentUnavailable?: boolean;
		/** Extra hint under the explanation (e.g. why the Stálý seznam is unavailable). */
		notice?: Snippet;
	}

	let {
		id,
		value,
		onvaluechange,
		disabled = false,
		permanentUnavailable = false,
		notice,
	}: WishlistOccasionFieldProps = $props();

	// Bits UI's single ToggleGroup clears its bound value when the active item is clicked again; a
	// writable `$derived` mirror of `value` lets onValueChange undo that transient deselect (the
	// same pattern as the recipient toggle in CreateWishlistModal).
	let selectedOccasion = $derived<string>(value);

	function isWishlistOccasion(candidate: string): candidate is WishlistOccasion {
		return WISHLIST_OCCASIONS.some((occasion) => occasion === candidate);
	}
</script>

<div class="flex flex-col gap-2">
	<Label id="{id}-label">{m.wishlist_occasion_label()}</Label>
	<ToggleGroup.Root
		type="single"
		intent="outline"
		bind:value={selectedOccasion}
		onValueChange={(nextValue) => {
			if (!isWishlistOccasion(nextValue)) {
				selectedOccasion = value;
				return;
			}
			onvaluechange(nextValue);
		}}
		{disabled}
		aria-labelledby="{id}-label"
		aria-describedby="{id}-help"
		class="grid w-full grid-cols-2 gap-2 sm:grid-cols-4"
		data-testid="wishlist-occasion-field"
	>
		{#each WISHLIST_OCCASIONS as occasion (occasion)}
			{@const display = WISHLIST_OCCASION_DISPLAY[occasion]}
			<ToggleGroup.Item
				value={occasion}
				disabled={occasion === WISHLIST_OCCASION.permanent && permanentUnavailable}
				class="h-auto min-h-12 w-full whitespace-normal sm:min-h-16"
				surfaceClass="justify-start gap-2 px-3 py-2 text-(length:--text-md) leading-tight sm:flex-col sm:justify-center sm:gap-1 sm:px-1 sm:text-center [&_svg]:size-5"
			>
				<display.icon aria-hidden="true" />
				{display.label()}
			</ToggleGroup.Item>
		{/each}
	</ToggleGroup.Root>
	<HelpText id="{id}-help">
		{value === WISHLIST_OCCASION.permanent
			? m.wishlist_kind_permanent_help()
			: m.wishlist_kind_occasion_help()}
	</HelpText>
	{@render notice?.()}
</div>
