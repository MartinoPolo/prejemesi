<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { Switch } from '$lib/components/base/switch/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	const { Story } = defineMeta({
		title: 'Base/Switch',
		component: Switch,
		tags: ['autodocs'],
	});
</script>

<Story name="Default">
	<div class="flex items-center gap-2">
		<Switch id="airplane-mode" />
		<Label for="airplane-mode">Airplane Mode</Label>
	</div>
</Story>

<Story name="Small">
	<div class="flex items-center gap-2">
		<Switch id="small-switch" size="sm" />
		<Label for="small-switch">Small switch</Label>
	</div>
</Story>

<Story name="Disabled">
	<div class="flex items-center gap-2">
		<Switch id="disabled-switch" disabled />
		<Label for="disabled-switch" class="opacity-50">Disabled</Label>
	</div>
</Story>

<Story name="All Sizes">
	<div class="flex flex-col gap-4">
		<div class="flex items-center gap-2">
			<Switch id="size-sm" size="sm" />
			<Label for="size-sm">Small</Label>
		</div>
		<div class="flex items-center gap-2">
			<Switch id="size-default" />
			<Label for="size-default">Default</Label>
		</div>
	</div>
</Story>
