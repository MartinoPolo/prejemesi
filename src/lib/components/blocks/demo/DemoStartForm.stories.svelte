<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import DemoStartForm from './DemoStartForm.svelte';

	const { Story } = defineMeta({
		title: 'Blocks/Demo/DemoStartForm',
		component: DemoStartForm,
		tags: ['autodocs'],
	});
</script>

<Story name="Landing entry">
	{#snippet template(args)}
		<DemoStartForm {...args} />
	{/snippet}
</Story>
