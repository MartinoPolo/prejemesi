<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { CARD_PADDING_OPTIONS, CARD_STATE_OPTIONS, Card } from './index.js';

	const { Story } = defineMeta({
		title: 'Base/Card',
		component: Card,
		tags: ['autodocs'],
		argTypes: {
			padding: {
				control: 'select',
				options: [...CARD_PADDING_OPTIONS],
			},
			state: {
				control: 'select',
				options: [...CARD_STATE_OPTIONS],
			},
		},
	});
</script>

<script lang="ts">
	import type { CardProps } from './card_variants.js';
</script>

<Story name="All Variants">
	{#snippet template(args: CardProps)}
		<div class="grid grid-cols-[7rem_repeat(2,minmax(0,1fr))] items-stretch gap-3">
			<div></div>
			{#each CARD_PADDING_OPTIONS as padding (padding)}
				<div class="text-center text-xs text-muted-foreground">{padding}</div>
			{/each}
			{#each CARD_STATE_OPTIONS as state (state)}
				<div class="self-center text-xs text-muted-foreground">{state}</div>
				{#each CARD_PADDING_OPTIONS as padding (padding)}
					<Card {...args} {padding} {state}>
						<p class="text-xs font-medium text-muted-foreground">{padding}</p>
						<p class="text-sm">{state}</p>
					</Card>
				{/each}
			{/each}
		</div>
	{/snippet}
</Story>

<Story name="Default" args={{ padding: 'padded' }}>
	{#snippet template(args: CardProps)}
		<Card {...args}>
			<p class="text-sm">Default card with padded content.</p>
		</Card>
	{/snippet}
</Story>

<Story name="No Padding">
	{#snippet template(args: CardProps)}
		<Card padding="none" {...args}>
			<div class="p-4">
				<p class="text-sm">Card with manual padding control.</p>
			</div>
		</Card>
	{/snippet}
</Story>

<Story name="All States">
	{#snippet template(args: CardProps)}
		<div class="grid grid-cols-2 gap-4">
			{#each CARD_STATE_OPTIONS as state (state)}
				<Card {...args} padding="padded" {state}>
					<p class="text-xs font-medium text-muted-foreground">{state}</p>
					<p class="text-sm">Card in {state} state.</p>
				</Card>
			{/each}
		</div>
	{/snippet}
</Story>

<Story name="Selected">
	{#snippet template(args: CardProps)}
		<Card padding="padded" state="selected" {...args}>
			<p class="text-sm">This card is selected.</p>
		</Card>
	{/snippet}
</Story>

<Story name="Loading">
	{#snippet template(args: CardProps)}
		<Card padding="padded" state="loading" {...args}>
			<p class="text-sm">Loading content...</p>
		</Card>
	{/snippet}
</Story>

<Story name="Error">
	{#snippet template(args: CardProps)}
		<Card padding="padded" state="error" {...args}>
			<p class="text-sm">Something went wrong.</p>
		</Card>
	{/snippet}
</Story>

<Story name="Accent Bar Color">
	{#snippet template(args: CardProps)}
		<Card padding="padded" accentBarColor="oklch(0.580 0.096 134)" {...args}>
			<p class="text-sm">Card with accent bar color.</p>
		</Card>
	{/snippet}
</Story>
