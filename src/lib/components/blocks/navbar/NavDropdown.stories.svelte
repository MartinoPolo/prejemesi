<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import NavDropdown from './NavDropdown.svelte';

	const { Story } = defineMeta({
		title: 'Blocks/Navbar/NavDropdown',
		component: NavDropdown,
		tags: ['autodocs'],
	});
</script>

<script lang="ts">
	import type { NavDropdownItem } from './navbar_types.js';
	import { wishlistSlotToFrameProps } from '$lib/modules/images/index.js';

	// No custom image assigned → thumb falls back to the theme emoji.
	const noImage = {
		imageUrl: null,
		imageFrame: wishlistSlotToFrameProps(null, 'thumbnail'),
	} satisfies Pick<NavDropdownItem, 'imageUrl' | 'imageFrame'>;

	const sampleItems: NavDropdownItem[] = [
		{
			name: 'Vanoce 2026',
			meta: '8 prani',
			href: '#1',
			emoji: '🎄',
			...noImage,
			badgeLabel: 'Sdileno',
			badgeVariant: 'shared',
		},
		{
			name: 'Narozeniny',
			meta: '5 prani',
			href: '#2',
			emoji: '🎂',
			...noImage,
			badgeLabel: 'Koncept',
			badgeVariant: 'draft',
		},
		{
			name: 'Velikonoce',
			meta: '3 prani',
			href: '#3',
			emoji: '🐣',
			...noImage,
		},
	];
</script>

<Story name="With Items">
	{#snippet template()}
		<div class="nav-item is-open story-wrapper">
			<NavDropdown title="Seznamy" viewAllHref="#all" items={sampleItems} />
		</div>
	{/snippet}
</Story>

<Story name="Empty State">
	{#snippet template()}
		<div class="nav-item is-open story-wrapper">
			<NavDropdown title="Seznamy" viewAllHref="#all" items={[]} />
		</div>
	{/snippet}
</Story>

<Story name="Single Item">
	{#snippet template()}
		<div class="nav-item is-open story-wrapper">
			<NavDropdown title="Seznamy" viewAllHref="#all" items={[sampleItems[0]]} />
		</div>
	{/snippet}
</Story>

<style>
	.story-wrapper {
		position: relative;
		display: inline-block;
		padding-top: 8px;
	}
</style>
