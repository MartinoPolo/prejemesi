<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import ThemeCardPreview from './ThemeCardPreview.svelte';

	const { Story } = defineMeta({
		title: 'Blocks/Wishlist/ThemeCardPreview',
		component: ThemeCardPreview,
		tags: ['autodocs'],
		args: { theme: 'default', emoji: '🎁', themeLabel: 'Default', title: 'Sample wishlist' },
	});
</script>

<Story name="All presets">
	{#snippet template()}
		<div class="flex flex-wrap gap-4">
			<ThemeCardPreview theme="default" emoji="🎁" themeLabel="Default" class="w-52" />
			<ThemeCardPreview theme="christmas" emoji="🎄" themeLabel="Christmas" class="w-52" />
			<ThemeCardPreview theme="birthday" emoji="🎂" themeLabel="Birthday" class="w-52" />
			<ThemeCardPreview theme="fun" emoji="🎉" themeLabel="Fun" class="w-52" />
			<ThemeCardPreview theme="elegant" emoji="💍" themeLabel="Elegant" class="w-52" />
		</div>
	{/snippet}
</Story>

<Story name="Default theme">
	{#snippet template()}
		<ThemeCardPreview
			theme="default"
			emoji="🎁"
			themeLabel="Default"
			title="Sample wishlist"
			class="w-60"
		/>
	{/snippet}
</Story>
