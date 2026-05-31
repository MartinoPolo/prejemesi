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
	<Label>Label text</Label>
</Story>

<Story name="With For">
	<Label for="input-id">Email address</Label>
</Story>
