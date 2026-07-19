<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, userEvent } from 'storybook/test';
	import WishlistPalettePicker from './WishlistPalettePicker.svelte';

	const { Story } = defineMeta({
		title: 'Blocks/Wishlist/PalettePicker',
		component: WishlistPalettePicker,
		tags: ['autodocs'],
	});

	/** Every swatch is a `<button aria-pressed>` — the selected one reads "true". */
	function getSwatches(canvasElement: HTMLElement): HTMLButtonElement[] {
		return Array.from(canvasElement.querySelectorAll('button[aria-pressed]'));
	}

	const playControlledSelection = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const swatches = getSwatches(canvasElement);

		// The initial `value` (sky = first palette) is the only pressed swatch.
		await expect(swatches[0]).toHaveAttribute('aria-pressed', 'true');
		await expect(
			swatches.filter((swatch) => swatch.getAttribute('aria-pressed') === 'true'),
		).toHaveLength(1);

		// Clicking the second swatch fires onchange, which updates the controlled
		// `value` and re-renders selection onto the clicked swatch only.
		await userEvent.click(swatches[1]);
		await expect(swatches[1]).toHaveAttribute('aria-pressed', 'true');
		await expect(swatches[0]).toHaveAttribute('aria-pressed', 'false');
	};
</script>

<script lang="ts">
	import type { Palette } from '$lib/theme/palettes.js';

	let value = $state<Palette>('sky');
</script>

<!-- Controlled usage: the caller owns `value` state and updates it in onchange. -->
<Story name="Controlled [play: selection updates]" play={playControlledSelection}>
	{#snippet template()}
		<div class="w-72">
			<WishlistPalettePicker {value} onchange={(palette) => (value = palette)} />
		</div>
	{/snippet}
</Story>

<Story name="Disabled">
	{#snippet template()}
		<div class="w-72">
			<WishlistPalettePicker value="sky" onchange={() => {}} disabled />
		</div>
	{/snippet}
</Story>
