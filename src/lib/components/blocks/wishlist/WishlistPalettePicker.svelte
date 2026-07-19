<script lang="ts">
	import {
		PALETTES,
		PALETTE_LABELS,
		PALETTE_SWATCHES,
		type Palette,
	} from '$lib/theme/palettes.js';
	import { cn } from '$lib/utils.js';

	interface WishlistPalettePickerProps {
		/** Currently selected palette (drives aria-pressed). */
		value: Palette;
		/** Fired with the clicked palette. Caller owns persistence/state. */
		onchange: (palette: Palette) => void;
		/** Disable all swatches (e.g. while a parent form submits). */
		disabled?: boolean;
	}

	let { value, onchange, disabled = false }: WishlistPalettePickerProps = $props();
</script>

<!-- Pure controlled wishlist palette picker (issue #102 REQ-5): the 10 curated
     palettes as a 2-column swatch grid. Selection + persistence live entirely with
     the caller — the auto-save-on-click flow lives in WishlistPaletteAutoSave. -->
<div class="grid grid-cols-2 gap-1">
	{#each PALETTES as paletteOption (paletteOption)}
		<button
			type="button"
			class={cn(
				'flex cursor-pointer items-center gap-2 rounded-btn border-2 border-transparent px-2 py-1.5 text-left text-(length:--text-sm) font-semibold text-foreground transition-colors',
				'hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
				'disabled:cursor-not-allowed disabled:opacity-50',
				paletteOption === value && 'border-ink bg-accent',
			)}
			aria-pressed={paletteOption === value}
			{disabled}
			onclick={() => onchange(paletteOption)}
		>
			<span
				class="size-4 shrink-0 rounded-full border-2 border-ink"
				style:background-color={PALETTE_SWATCHES[paletteOption]}
				aria-hidden="true"
			></span>
			{PALETTE_LABELS[paletteOption]}
		</button>
	{/each}
</div>
