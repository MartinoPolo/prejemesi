<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { WishlistPreview } from './index.js';

	const { Story } = defineMeta({
		title: 'Derived/WishlistPreview',
		component: WishlistPreview,
		tags: ['autodocs'],
	});
</script>

<Story name="Default">
	{#snippet template()}
		<div class="w-72">
			<WishlistPreview emoji="🎁" label="Vánoční přání" />
		</div>
	{/snippet}
</Story>

<Story name="Birthday">
	{#snippet template()}
		<div class="w-72">
			<WishlistPreview emoji="🎂" label="Narozeniny" />
		</div>
	{/snippet}
</Story>

<Story name="No label">
	{#snippet template()}
		<div class="w-72">
			<WishlistPreview emoji="✨" />
		</div>
	{/snippet}
</Story>
