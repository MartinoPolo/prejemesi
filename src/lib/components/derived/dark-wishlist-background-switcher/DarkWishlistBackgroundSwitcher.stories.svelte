<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import DarkWishlistBackgroundSwitcher from './DarkWishlistBackgroundSwitcher.svelte';

	const { Story } = defineMeta({
		title: 'Derived/DarkWishlistBackgroundSwitcher',
		component: DarkWishlistBackgroundSwitcher,
		tags: ['autodocs'],
	});
</script>

<Story name="Default">
	{#snippet template()}
		<div class="w-full max-w-xl">
			<DarkWishlistBackgroundSwitcher />
		</div>
	{/snippet}
</Story>

<Story name="Phone width">
	{#snippet template()}
		<div class="w-[343px]">
			<DarkWishlistBackgroundSwitcher />
		</div>
	{/snippet}
</Story>
