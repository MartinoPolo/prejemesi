<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { TEXTAREA_STATES, Textarea } from './index.js';
	import { Label } from '$lib/components/base/label/index.js';

	const { Story } = defineMeta({
		title: 'Base/Textarea',
		component: Textarea,
		tags: ['autodocs'],
		argTypes: {
			state: {
				control: 'select',
				options: [...TEXTAREA_STATES],
			},
			disabled: { control: 'boolean' },
		},
	});
</script>

<script lang="ts">
	import type { TextareaProps } from './textarea_variants.js';
</script>

<Story name="All Variants">
	{#snippet template(args: TextareaProps)}
		<div class="grid max-w-2xl grid-cols-2 gap-4">
			{#each TEXTAREA_STATES as state (state)}
				<div>
					<Label>{state}</Label>
					<Textarea
						{...args}
						{state}
						aria-label={state}
						rows={3}
						value={state === 'error'
							? ''
							: 'Surface session failures and PR review state directly above each tree.'}
					/>
				</div>
			{/each}
		</div>
	{/snippet}
</Story>

<Story name="Default">
	{#snippet template(args: TextareaProps)}
		<div class="max-w-sm">
			<Label for="desc">Description</Label>
			<Textarea id="desc" rows={3} placeholder="Describe the change…" {...args} />
		</div>
	{/snippet}
</Story>

<Story name="Filled">
	{#snippet template(args: TextareaProps)}
		<div class="max-w-sm">
			<Label for="filled">Description</Label>
			<Textarea
				id="filled"
				rows={3}
				value="Surface session failures and PR review state directly above each tree."
				{...args}
			/>
		</div>
	{/snippet}
</Story>

<Story name="Error">
	{#snippet template(args: TextareaProps)}
		<div class="max-w-sm">
			<Label for="error-ta">Description</Label>
			<Textarea id="error-ta" state="error" rows={2} value="" {...args} />
		</div>
	{/snippet}
</Story>

<Story name="Disabled">
	{#snippet template(args: TextareaProps)}
		<div class="max-w-sm">
			<Label for="disabled-ta">Description</Label>
			<Textarea
				id="disabled-ta"
				disabled
				rows={3}
				value="Locked while session running"
				{...args}
			/>
		</div>
	{/snippet}
</Story>

<Story name="All States">
	{#snippet template(args: TextareaProps)}
		<div class="grid max-w-2xl grid-cols-2 gap-4">
			<div>
				<Label>Default</Label>
				<Textarea
					rows={3}
					placeholder="Describe the change…"
					aria-label="Default"
					{...args}
				/>
			</div>
			<div>
				<Label>Focus (interact)</Label>
				<Textarea
					rows={3}
					aria-label="Focus"
					value="Surface session failures and PR review state directly above each tree."
				/>
			</div>
			<div>
				<Label>Error</Label>
				<Textarea state="error" rows={2} aria-label="Error" />
			</div>
			<div>
				<Label>Disabled</Label>
				<Textarea
					disabled
					rows={3}
					aria-label="Disabled"
					value="Locked while session running"
				/>
			</div>
		</div>
	{/snippet}
</Story>
