<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, userEvent, within } from 'storybook/test';
	import { INPUT_STATES, Input } from './index.js';
	import { Label } from '$lib/components/base/label/index.js';

	const { Story } = defineMeta({
		title: 'Base/Input',
		component: Input,
		tags: ['autodocs'],
		argTypes: {
			state: {
				control: 'select',
				options: [...INPUT_STATES],
			},
			disabled: { control: 'boolean' },
			readonly: { control: 'boolean' },
		},
	});

	const playTypeUpdatesValue = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement);
		const input = canvas.getByRole('textbox');
		await userEvent.clear(input);
		await userEvent.type(input, 'hello world');
		await expect(input).toHaveValue('hello world');
	};

	const playFocusOnClick = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement);
		const input = canvas.getByRole('textbox');
		await userEvent.click(input);
		await expect(input).toHaveFocus();
	};

	const playDisabledRejectsTyping = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement);
		const input = canvas.getByRole('textbox');
		await expect(input).toBeDisabled();
		const valueBefore = (input as HTMLInputElement).value;
		await userEvent.type(input, 'should not appear');
		await expect(input).toHaveValue(valueBefore);
	};
</script>

<script lang="ts">
	import type { InputProps } from './input_variants.js';
</script>

<Story name="All Variants">
	{#snippet template(args: InputProps)}
		<div class="grid max-w-2xl grid-cols-2 gap-4">
			{#each INPUT_STATES as state (state)}
				<div>
					<Label>{state}</Label>
					<Input
						{...args}
						{state}
						aria-label={state}
						value={state === 'loading' ? 'resolving...' : 'feat/forest-overlays'}
					/>
				</div>
			{/each}
		</div>
	{/snippet}
</Story>

<Story name="Default" args={{ state: 'default' }}>
	{#snippet template(args: InputProps)}
		<div class="max-w-xs">
			<Input placeholder="Branch name" aria-label="Branch name" {...args} />
		</div>
	{/snippet}
</Story>

<Story name="Filled">
	{#snippet template(args: InputProps)}
		<div class="max-w-xs">
			<Input value="feat/forest-overlays" aria-label="Branch name" {...args} />
		</div>
	{/snippet}
</Story>

<Story name="Success">
	{#snippet template(args: InputProps)}
		<div class="max-w-xs">
			<Label for="success-demo">Branch name</Label>
			<Input id="success-demo" state="success" value="feat/valid-name" {...args} />
		</div>
	{/snippet}
</Story>

<Story name="Error">
	{#snippet template(args: InputProps)}
		<div class="max-w-xs">
			<Label for="error-demo">Branch name</Label>
			<Input id="error-demo" state="error" value="feat/forest overlays" {...args} />
		</div>
	{/snippet}
</Story>

<Story name="Disabled">
	{#snippet template(args: InputProps)}
		<div class="max-w-xs">
			<Input disabled value="feat/locked-branch" aria-label="Disabled branch" {...args} />
		</div>
	{/snippet}
</Story>

<Story name="Read Only">
	{#snippet template(args: InputProps)}
		<div class="max-w-xs">
			<Input readonly value="main" aria-label="Read-only branch" {...args} />
		</div>
	{/snippet}
</Story>

<Story name="Loading">
	{#snippet template(args: InputProps)}
		<div class="max-w-xs">
			<Input state="loading" value="resolving..." aria-label="Loading branch" {...args} />
		</div>
	{/snippet}
</Story>

<Story name="Type Updates Value [play: type updates value]" play={playTypeUpdatesValue}>
	{#snippet template(args: InputProps)}
		<div class="max-w-xs">
			<Input placeholder="Type here" aria-label="Branch name" {...args} />
		</div>
	{/snippet}
</Story>

<Story name="Focus On Click [play: focus on click]" play={playFocusOnClick}>
	{#snippet template(args: InputProps)}
		<div class="max-w-xs">
			<Input placeholder="Click to focus" aria-label="Branch name" {...args} />
		</div>
	{/snippet}
</Story>

<Story
	name="Disabled Rejects Typing [play: disabled rejects typing]"
	play={playDisabledRejectsTyping}
>
	{#snippet template(args: InputProps)}
		<div class="max-w-xs">
			<Input disabled value="feat/locked-branch" aria-label="Disabled branch" {...args} />
		</div>
	{/snippet}
</Story>

<Story name="All States">
	{#snippet template(args: InputProps)}
		<div class="grid max-w-2xl grid-cols-3 gap-4">
			<div>
				<Label>Default</Label>
				<Input placeholder="Branch name" aria-label="Default" {...args} />
			</div>
			<div>
				<Label>Filled</Label>
				<Input value="feat/forest-overlays" aria-label="Filled" />
			</div>
			<div>
				<Label>Focus (interact)</Label>
				<Input value="feat/forest-overlays" aria-label="Focus" />
			</div>
			<div>
				<Label>Success</Label>
				<Input state="success" value="feat/valid-name" aria-label="Success" />
			</div>
			<div>
				<Label>Error</Label>
				<Input state="error" value="feat/forest overlays" aria-label="Error" />
			</div>
			<div>
				<Label>Disabled</Label>
				<Input disabled value="feat/locked-branch" aria-label="Disabled" />
			</div>
			<div>
				<Label>Read-only</Label>
				<Input readonly value="main" aria-label="Read-only" />
			</div>
			<div>
				<Label>Loading</Label>
				<Input state="loading" value="resolving..." aria-label="Loading" />
			</div>
		</div>
	{/snippet}
</Story>
