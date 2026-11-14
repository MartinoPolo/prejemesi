<script lang="ts">
	import {
		PALETTES,
		PALETTE_LABELS,
		PALETTE_SWATCHES,
		type Palette,
	} from '$lib/theme/palettes.js';
	import { ChoiceRow } from '$lib/components/derived/choice-row/index.js';
	import { cn } from '$lib/utils.js';

	interface WishlistPalettePickerProps {
		/** Currently selected palette (drives aria-pressed). */
		value: Palette;
		/** Fired with the clicked palette. Caller owns persistence/state. */
		onchange: (palette: Palette) => void;
		/** Disable all swatches (e.g. while a parent form submits). */
		disabled?: boolean;
		class?: string;
	}

	let {
		value,
		onchange,
		disabled = false,
		class: className,
	}: WishlistPalettePickerProps = $props();
</script>

<!-- Pure controlled wishlist palette picker: selection is a local settings draft;
     the parent composite save owns persistence. -->
<div
	class={cn('mx-auto flex max-w-[45rem] flex-wrap justify-center gap-2', className)}
	data-testid="wishlist-palette-picker"
>
	{#each PALETTES as paletteOption (paletteOption)}
		<ChoiceRow
			class="w-32 max-w-full flex-none"
			selected={paletteOption === value}
			{disabled}
			onSelect={() => onchange(paletteOption)}
		>
			{#snippet leading()}
				<span
					class="size-4 shrink-0 rounded-full border-2 border-edge"
					style:background-color={PALETTE_SWATCHES[paletteOption]}
					aria-hidden="true"
				></span>
			{/snippet}
			{PALETTE_LABELS[paletteOption]}
		</ChoiceRow>
	{/each}
</div>
