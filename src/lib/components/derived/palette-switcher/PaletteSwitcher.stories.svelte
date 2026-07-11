<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import PaletteSwitcher from './PaletteSwitcher.svelte';

	const { Story } = defineMeta({
		title: 'Derived/PaletteSwitcher',
		component: PaletteSwitcher,
		tags: ['autodocs'],
	});
</script>

<Story name="Default">
	{#snippet template()}
		<PaletteSwitcher />
	{/snippet}
</Story>
