<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import WishlistFallbackHero from './WishlistFallbackHero.svelte';

	const { Story } = defineMeta({
		title: 'Blocks/Wishlist/WishlistFallbackHero',
		component: WishlistFallbackHero,
		tags: ['autodocs'],
	});
</script>

<Story name="Banner">
	{#snippet template()}
		<div class="h-40 w-96 overflow-hidden rounded-xl">
			<WishlistFallbackHero emoji="🎁" label="Sample wishlist" />
		</div>
	{/snippet}
</Story>

<Story name="Thumbnail">
	{#snippet template()}
		<div class="size-16 overflow-hidden rounded-lg">
			<WishlistFallbackHero emoji="🎄" label="Christmas list" />
		</div>
	{/snippet}
</Story>

<Story name="Scales">
	{#snippet template()}
		<div class="flex items-end gap-4">
			<div class="size-12 overflow-hidden rounded-lg">
				<WishlistFallbackHero emoji="🎂" />
			</div>
			<div class="size-24 overflow-hidden rounded-lg">
				<WishlistFallbackHero emoji="🎂" />
			</div>
			<div class="h-32 w-48 overflow-hidden rounded-xl">
				<WishlistFallbackHero emoji="🎂" />
			</div>
		</div>
	{/snippet}
</Story>
