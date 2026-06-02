<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { Slider } from '$lib/components/base/slider/index.js';

	const { Story } = defineMeta({
		title: 'Base/Slider',
		component: Slider,
		tags: ['autodocs'],
	});
</script>

<Story name="Default">
	<div class="w-64">
		<Slider value={50} min={0} max={100} step={1} aria-label="Value" />
	</div>
</Story>

<Story name="Zoom range">
	<div class="w-64">
		<Slider value={150} min={100} max={300} step={5} aria-label="Zoom" />
	</div>
</Story>

<Story name="Disabled">
	<div class="w-64">
		<Slider value={100} min={100} max={300} step={5} disabled aria-label="Zoom" />
	</div>
</Story>
