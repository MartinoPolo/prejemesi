<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { Checkbox } from '$lib/components/base/checkbox/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	const { Story } = defineMeta({
		title: 'Base/Checkbox',
		component: Checkbox,
		tags: ['autodocs'],
	});
</script>

<Story name="Default">
	<div class="flex items-center gap-2">
		<Checkbox id="terms" />
		<Label for="terms">Accept terms and conditions</Label>
	</div>
</Story>

<Story name="Checked">
	<div class="flex items-center gap-2">
		<Checkbox id="checked" checked={true} />
		<Label for="checked">Checked</Label>
	</div>
</Story>

<Story name="Disabled">
	<div class="flex items-center gap-2">
		<Checkbox id="disabled" disabled />
		<Label for="disabled" class="opacity-50">Disabled</Label>
	</div>
</Story>

<Story name="All States">
	<div class="flex flex-col gap-4">
		<div class="flex items-center gap-2">
			<Checkbox id="unchecked-state" />
			<Label for="unchecked-state">Unchecked</Label>
		</div>
		<div class="flex items-center gap-2">
			<Checkbox id="checked-state" checked={true} />
			<Label for="checked-state">Checked</Label>
		</div>
		<div class="flex items-center gap-2">
			<Checkbox id="disabled-state" disabled />
			<Label for="disabled-state" class="opacity-50">Disabled</Label>
		</div>
	</div>
</Story>
