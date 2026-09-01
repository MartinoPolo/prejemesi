<script lang="ts">
	import type { Palette } from '$lib/theme/palettes.js';
	import WishlistPalettePicker from './WishlistPalettePicker.svelte';

	interface Props {
		palette: Palette;
		onselect?: (palette: Palette) => void;
		ondirtychange?: (dirty: boolean, palette: Palette) => void;
		discardVersion?: number;
		commitVersion?: number;
		disabled?: boolean;
	}

	let {
		palette,
		onselect,
		ondirtychange,
		discardVersion = 0,
		commitVersion = 0,
		disabled = false,
	}: Props = $props();
	// svelte-ignore state_referenced_locally (the draft seeds once when the modal mounts)
	let selected = $state(palette);
	// svelte-ignore state_referenced_locally (one-time persisted baseline)
	let baseline = $state(palette);
	// svelte-ignore state_referenced_locally (one-time version seeds)
	let seenDiscardVersion = $state(discardVersion);
	// svelte-ignore state_referenced_locally (one-time version seeds)
	let seenCommitVersion = $state(commitVersion);

	$effect(() => ondirtychange?.(selected !== baseline, selected));
	$effect(() => {
		if (discardVersion !== seenDiscardVersion) {
			seenDiscardVersion = discardVersion;
			selected = baseline;
			onselect?.(baseline);
		}
	});
	$effect(() => {
		if (commitVersion !== seenCommitVersion) {
			seenCommitVersion = commitVersion;
			baseline = selected;
		}
	});

	function selectPalette(next: Palette) {
		if (next === selected) {
			return;
		}
		selected = next;
		onselect?.(next);
	}
</script>

<WishlistPalettePicker value={selected} onchange={selectPalette} {disabled} />
