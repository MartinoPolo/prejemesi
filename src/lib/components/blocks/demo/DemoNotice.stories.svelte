<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import DemoNotice from './DemoNotice.svelte';

	const { Story } = defineMeta({
		title: 'Blocks/Demo/DemoNotice',
		component: DemoNotice,
		tags: ['autodocs'],
	});
</script>

<Story name="Active playground">
	{#snippet template(args)}
		<DemoNotice
			{...args}
			expiresAt={new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()}
			onexpired={() => {}}
		/>
	{/snippet}
</Story>
