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
	import type { NavDropdownItem } from './navbar-types.js';

	const sampleItems: NavDropdownItem[] = [
		{
			name: 'Vanoce 2026',
			meta: '8 prani',
			href: '#1',
			emoji: '🎄',
			badgeLabel: 'Sdileno',
			badgeVariant: 'shared',
		},
		{
			name: 'Narozeniny',
			meta: '5 prani',
			href: '#2',
			emoji: '🎂',
			badgeLabel: 'Koncept',
			badgeVariant: 'draft',
		},
		{
			name: 'Velikonoce',
			meta: '3 prani',
			href: '#3',
			emoji: '🐣',
		},
	];
</script>

<Story name="With Items">
	<div class="nav-item is-open story-wrapper">
		<NavDropdown title="Seznamy" viewAllHref="#all" items={sampleItems} />
	</div>
</Story>

<Story name="Empty State">
	<div class="nav-item is-open story-wrapper">
		<NavDropdown title="Seznamy" viewAllHref="#all" items={[]} />
	</div>
</Story>

<Story name="Single Item">
	<div class="nav-item is-open story-wrapper">
		<NavDropdown title="Seznamy" viewAllHref="#all" items={[sampleItems[0]]} />
	</div>
</Story>

<style>
	.story-wrapper {
		position: relative;
		display: inline-block;
		padding-top: 8px;
	}
</style>
