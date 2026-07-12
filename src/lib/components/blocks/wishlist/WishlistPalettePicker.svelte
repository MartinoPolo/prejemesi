<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { toastError, toastSuccess } from '$lib/components/base/toast/index.js';
	import { translateServerError } from '$lib/modules/errors/translate_server_error.js';
	import { setWishlistPalette } from '$lib/modules/wishlists/wishlists.remote.js';
	import {
		PALETTES,
		PALETTE_LABELS,
		PALETTE_SWATCHES,
		type Palette,
	} from '$lib/theme/palettes.js';
	import { cn } from '$lib/utils.js';

	interface WishlistPalettePickerProps {
		wishlistId: string;
		/** Current wishlist palette (drives aria-pressed selection). */
		palette: Palette;
		/** Optimistic callback so the page retitles its `data-palette` subtree instantly. */
		onselect?: (palette: Palette) => void;
	}

	let { wishlistId, palette, onselect }: WishlistPalettePickerProps = $props();

	let isSaving = $state(false);

	async function selectPalette(nextPalette: Palette) {
		if (nextPalette === palette || isSaving) {
			return;
		}

		const previousPalette = palette;
		// Instant feedback: the wishlist page wrapper re-derives its tokens right away.
		onselect?.(nextPalette);
		isSaving = true;
		try {
			// Server refreshes the wishlist + dashboard queries in the same round trip.
			await setWishlistPalette({ wishlistId, palette: nextPalette });
			toastSuccess(m.toast_palette_saved());
		} catch (thrown) {
			onselect?.(previousPalette);
			toastError(translateServerError(thrown, m.toast_palette_save_error()));
		} finally {
			isSaving = false;
		}
	}
</script>

<!-- Wishlist palette picker (issue #102 REQ-5): the 10 curated palettes as a
     2-column swatch grid, mirroring the header PaletteSwitcher's pattern but
     writing the WISHLIST palette, not the viewer preference. -->
<div class="grid grid-cols-2 gap-1">
	{#each PALETTES as paletteOption (paletteOption)}
		<button
			type="button"
			class={cn(
				'flex cursor-pointer items-center gap-2 rounded-btn border-2 border-transparent px-2 py-1.5 text-left text-(length:--text-sm) font-semibold text-foreground transition-colors',
				'hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
				paletteOption === palette && 'border-ink bg-accent',
			)}
			aria-pressed={paletteOption === palette}
			onclick={() => selectPalette(paletteOption)}
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
