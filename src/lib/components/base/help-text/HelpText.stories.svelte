<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { HELP_TEXT_STATES, HelpText } from './index.js';

	const { Story } = defineMeta({
		title: 'Base/HelpText',
		component: HelpText,
		tags: ['autodocs'],
		argTypes: {
			state: {
				control: 'select',
				options: [...HELP_TEXT_STATES],
			},
		},
	});
</script>

<script lang="ts">
	import type { HelpTextProps } from './help_text_variants.js';
</script>

<Story name="All Variants">
	{#snippet template(args: HelpTextProps)}
		<div class="flex w-80 flex-col gap-2">
			{#each HELP_TEXT_STATES as state (state)}
				<HelpText {...args} {state}>Help text state: {state}.</HelpText>
			{/each}
		</div>
	{/snippet}
</Story>

<Story name="Default" args={{ state: 'default' }}>
	{#snippet template(args: HelpTextProps)}
		<div class="w-80">
			<HelpText {...args}>Enter a value between 1 and 100.</HelpText>
		</div>
	{/snippet}
</Story>

<Story name="Error State" args={{ state: 'error' }}>
	{#snippet template(args: HelpTextProps)}
		<div class="w-80">
			<HelpText {...args}>This field is required.</HelpText>
		</div>
	{/snippet}
</Story>

<Story name="Success State" args={{ state: 'success' }}>
	{#snippet template(args: HelpTextProps)}
		<div class="w-80">
			<HelpText {...args}>Your changes have been saved successfully.</HelpText>
		</div>
	{/snippet}
</Story>

<Story name="Long Text" args={{ state: 'default' }}>
	{#snippet template(args: HelpTextProps)}
		<div class="w-80">
			<HelpText {...args}>
				This is a longer help text message that is intended to wrap across multiple lines
				when displayed inside a constrained container width.
			</HelpText>
		</div>
	{/snippet}
</Story>
