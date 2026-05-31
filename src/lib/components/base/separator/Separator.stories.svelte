<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { Separator } from '$lib/components/base/separator/index.js';
	const { Story } = defineMeta({
		title: 'Base/Separator',
		component: Separator,
		tags: ['autodocs'],
	});
</script>

<Story name="Horizontal">
	<div class="flex flex-col gap-4">
		<p class="text-sm">Content above</p>
		<Separator />
		<p class="text-sm">Content below</p>
	</div>
</Story>

<Story name="Vertical">
	<div class="flex h-8 items-center gap-4">
		<span class="text-sm">Left</span>
		<Separator orientation="vertical" />
		<span class="text-sm">Right</span>
	</div>
</Story>
