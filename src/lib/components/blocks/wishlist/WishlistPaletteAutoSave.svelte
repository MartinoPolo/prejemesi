<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { toastError, toastSuccess } from '$lib/components/base/toast/index.js';
	import { translateServerError } from '$lib/modules/errors/translate_server_error.js';
	import { setWishlistPalette } from '$lib/modules/wishlists/wishlists.remote.js';
	import type { Palette } from '$lib/theme/palettes.js';
	import WishlistPalettePicker from './WishlistPalettePicker.svelte';

	interface WishlistPaletteAutoSaveProps {
		wishlistId: string;
		/** Current wishlist palette (drives selection). */
		palette: Palette;
		/** Optimistic callback so the page retitles its `data-palette` subtree instantly. */
		onselect?: (palette: Palette) => void;
	}

	let { wishlistId, palette, onselect }: WishlistPaletteAutoSaveProps = $props();

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

<WishlistPalettePicker value={palette} onchange={selectPalette} />
