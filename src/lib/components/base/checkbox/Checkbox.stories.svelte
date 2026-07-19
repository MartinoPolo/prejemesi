<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, userEvent, within } from 'storybook/test';
	import { Checkbox } from '$lib/components/base/checkbox/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import StoryKeyboardHints from '$lib/storybook/StoryKeyboardHints.svelte';
	import KeyboardHint from '$lib/storybook/KeyboardHint.svelte';

	const { Story } = defineMeta({
		title: 'Base/Checkbox',
		component: Checkbox,
		tags: ['autodocs'],
		argTypes: {
			checked: { control: 'boolean' },
			indeterminate: { control: 'boolean' },
			disabled: { control: 'boolean' },
		},
	});

	const playClickToCheck = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement);
		const checkbox = canvas.getByRole('checkbox');
		await expect(checkbox).toHaveAttribute('aria-checked', 'false');
		await userEvent.click(checkbox);
		await expect(checkbox).toHaveAttribute('aria-checked', 'true');
	};

	const playClickToUncheck = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement);
		const checkbox = canvas.getByRole('checkbox');
		await expect(checkbox).toHaveAttribute('aria-checked', 'true');
		await userEvent.click(checkbox);
		await expect(checkbox).toHaveAttribute('aria-checked', 'false');
	};

	const playDisabledNoChange = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement);
		const checkboxes = canvas.getAllByRole('checkbox');
		const uncheckedDisabled = checkboxes[0];
		const checkedDisabled = checkboxes[1];

		await expect(uncheckedDisabled).toBeDisabled();
		await expect(uncheckedDisabled).toHaveAttribute('aria-checked', 'false');
		await userEvent.click(uncheckedDisabled);
		await expect(uncheckedDisabled).toHaveAttribute('aria-checked', 'false');

		await expect(checkedDisabled).toBeDisabled();
		await expect(checkedDisabled).toHaveAttribute('aria-checked', 'true');
		await userEvent.click(checkedDisabled);
		await expect(checkedDisabled).toHaveAttribute('aria-checked', 'true');
	};

	const playKeyboardToggle = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement);
		const checkbox = canvas.getByRole('checkbox');
		await expect(checkbox).toHaveAttribute('aria-checked', 'false');
		await checkbox.focus();
		await userEvent.keyboard(' ');
		await expect(checkbox).toHaveAttribute('aria-checked', 'true');
		await userEvent.keyboard(' ');
		await expect(checkbox).toHaveAttribute('aria-checked', 'false');
	};
</script>

<script lang="ts">
	import type { ComponentProps } from 'svelte';

	type CheckboxProps = ComponentProps<typeof Checkbox>;
</script>

<Story name="All States">
	{#snippet template(args: CheckboxProps)}
		<div class="grid grid-cols-4 gap-6">
			<div class="flex flex-col items-center gap-2">
				<span class="text-xs text-muted-foreground">Unchecked</span>
				<Checkbox {...args} />
			</div>
			<div class="flex flex-col items-center gap-2">
				<span class="text-xs text-muted-foreground">Checked</span>
				<Checkbox checked />
			</div>
			<div class="flex flex-col items-center gap-2">
				<span class="text-xs text-muted-foreground">Indeterminate</span>
				<Checkbox indeterminate />
			</div>
			<div class="flex flex-col items-center gap-2">
				<span class="text-xs text-muted-foreground">Disabled</span>
				<Checkbox disabled />
			</div>
			<div class="flex flex-col items-center gap-2">
				<span class="text-xs text-muted-foreground">Disabled + Checked</span>
				<Checkbox disabled checked />
			</div>
			<div class="col-span-3 flex flex-col gap-2">
				<span class="text-xs text-muted-foreground">With label</span>
				<div class="flex items-center gap-2">
					<Checkbox id="cb-label-demo" checked />
					<Label for="cb-label-demo" class="mb-0 cursor-pointer text-(length:--text-md)"
						>Accept terms and conditions</Label
					>
				</div>
			</div>
		</div>
	{/snippet}
</Story>

<Story name="Unchecked [play: click to check]" play={playClickToCheck}>
	{#snippet template(args: CheckboxProps)}
		<Checkbox {...args} />
	{/snippet}
</Story>

<Story name="Checked [play: click to uncheck]" play={playClickToUncheck}>
	{#snippet template(args: CheckboxProps)}
		<Checkbox checked {...args} />
	{/snippet}
</Story>

<Story name="Indeterminate">
	{#snippet template(args: CheckboxProps)}
		<Checkbox indeterminate {...args} />
	{/snippet}
</Story>

<Story name="Disabled [play: disabled no change]" play={playDisabledNoChange}>
	{#snippet template(args: CheckboxProps)}
		<div class="flex items-center gap-4">
			<Checkbox disabled {...args} />
			<Checkbox disabled checked {...args} />
		</div>
	{/snippet}
</Story>

<Story name="Keyboard Toggle [play: keyboard toggle]" play={playKeyboardToggle}>
	{#snippet template(args: CheckboxProps)}
		<div class="w-80">
			<StoryKeyboardHints>
				<KeyboardHint keys="Space" action="Toggle checked state" />
			</StoryKeyboardHints>
			<Checkbox {...args} />
		</div>
	{/snippet}
</Story>

<Story name="With Label">
	{#snippet template(args: CheckboxProps)}
		<div class="flex items-center gap-2">
			<Checkbox id="terms" checked {...args} />
			<Label for="terms" class="mb-0 cursor-pointer text-(length:--text-md)"
				>Accept terms and conditions</Label
			>
		</div>
	{/snippet}
</Story>
