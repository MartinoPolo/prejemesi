<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import * as ToggleGroup from '$lib/components/base/toggle-group/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import type { ToggleSize } from '$lib/components/base/toggle/toggle_variants.js';
	import {
		WISHLIST_KIND,
		WISHLIST_KINDS,
		type WishlistKind,
	} from '$lib/modules/wishlists/types.js';

	interface WishlistKindFieldProps {
		/** Prefix for the label/help ids, unique per surface. */
		id: string;
		value: WishlistKind;
		onvaluechange: (kind: WishlistKind) => void;
		disabled?: boolean;
		/** The server rejects making an occasion wishlist with an upcoming event date permanent. */
		permanentUnavailable?: boolean;
		size?: ToggleSize;
		/** Extra hint under the kind explanation (e.g. why an option is unavailable). */
		notice?: Snippet;
	}

	let {
		id,
		value,
		onvaluechange,
		disabled = false,
		permanentUnavailable = false,
		size,
		notice,
	}: WishlistKindFieldProps = $props();

	// Bits UI's single ToggleGroup clears its bound value when the active item is clicked again; a
	// writable `$derived` mirror of `value` lets onValueChange undo that transient deselect (the
	// same pattern as the recipient toggle in CreateWishlistModal).
	let selectedKind = $derived<string>(value);

	function isWishlistKind(candidate: string): candidate is WishlistKind {
		return WISHLIST_KINDS.some((kind) => kind === candidate);
	}
</script>

<div class="flex flex-col gap-2">
	<Label id="{id}-label">{m.wishlist_kind_label()}</Label>
	<ToggleGroup.Root
		type="single"
		intent="outline"
		{size}
		bind:value={selectedKind}
		onValueChange={(nextValue) => {
			if (!isWishlistKind(nextValue)) {
				selectedKind = value;
				return;
			}
			onvaluechange(nextValue);
		}}
		{disabled}
		aria-labelledby="{id}-label"
		aria-describedby="{id}-help"
		class="w-full gap-2"
	>
		<ToggleGroup.Item value={WISHLIST_KIND.occasion} class="flex-1">
			{m.wishlist_kind_occasion()}
		</ToggleGroup.Item>
		<ToggleGroup.Item
			value={WISHLIST_KIND.permanent}
			class="flex-1"
			disabled={permanentUnavailable}
		>
			{m.wishlist_kind_permanent()}
		</ToggleGroup.Item>
	</ToggleGroup.Root>
	<HelpText id="{id}-help">
		{value === WISHLIST_KIND.permanent
			? m.wishlist_kind_permanent_help()
			: m.wishlist_kind_occasion_help()}
	</HelpText>
	{@render notice?.()}
</div>
