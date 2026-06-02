<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { Label } from '$lib/components/base/label/index.js';
	const { Story } = defineMeta({
		title: 'Base/Label',
		component: Label,
		tags: ['autodocs'],
	});
</script>

<Story name="Default">
	{#snippet template()}
		<Label>Label text</Label>
	{/snippet}
</Story>

<Story name="With For">
	{#snippet template()}
		<Label for="input-id">Email address</Label>
	{/snippet}
</Story>
