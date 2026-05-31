<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { Progress } from './index.js';

	const { Story } = defineMeta({
		title: 'Base/Progress',
		component: Progress,
		tags: ['autodocs'],
		argTypes: {
			value: { control: 'range', min: 0, max: 100 },
		},
	});
</script>

<Story name="Default" args={{ value: 50 }}>
	{#snippet template(args)}
		<div class="w-80 space-y-1">
			<p class="text-muted-foreground text-sm">{args.value ?? 0}%</p>
			<Progress aria-label="Progress" {...args} />
		</div>
	{/snippet}
</Story>
