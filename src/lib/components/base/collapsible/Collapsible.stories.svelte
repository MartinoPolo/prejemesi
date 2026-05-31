<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, userEvent, waitFor } from 'storybook/test';
	import * as Collapsible from './index.js';
	import StoryKeyboardHints from '$lib/storybook/StoryKeyboardHints.svelte';
	import KeyboardHint from '$lib/storybook/KeyboardHint.svelte';

	const { Story } = defineMeta({
		title: 'Base/Collapsible',
		component: Collapsible.Root,
		tags: ['autodocs'],
	});

	function getTrigger(canvasElement: HTMLElement): HTMLElement {
		const trigger = canvasElement.querySelector('[data-slot="collapsible-trigger"]');
		if (!trigger) {
			throw new Error('Collapsible trigger not found');
		}
		return trigger as HTMLElement;
	}

	function getContent(canvasElement: HTMLElement): HTMLElement | null {
		return canvasElement.querySelector('[data-slot="collapsible-content"]');
	}

	const playClickOpens = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const trigger = getTrigger(canvasElement);

		await expect(trigger).toHaveAttribute('data-state', 'closed');
		await expect(getContent(canvasElement)).toHaveAttribute('data-state', 'closed');

		await userEvent.click(trigger);

		await waitFor(() => {
			expect(trigger).toHaveAttribute('data-state', 'open');
			expect(getContent(canvasElement)).toHaveAttribute('data-state', 'open');
		});
	};

	const playClickCloses = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const trigger = getTrigger(canvasElement);

		await expect(trigger).toHaveAttribute('data-state', 'open');
		await expect(getContent(canvasElement)).toBeInTheDocument();

		await userEvent.click(trigger);

		await waitFor(() => {
			expect(trigger).toHaveAttribute('data-state', 'closed');
		});
	};

	const playDisabledNoChange = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const trigger = getTrigger(canvasElement);

		await expect(trigger).toHaveAttribute('data-state', 'closed');
		await expect(trigger).toBeDisabled();

		trigger.click();

		await waitFor(() => {
			expect(trigger).toHaveAttribute('data-state', 'closed');
			expect(getContent(canvasElement)).toHaveAttribute('data-state', 'closed');
		});
	};

	const playKeyboardToggle = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const trigger = getTrigger(canvasElement);

		await expect(trigger).toHaveAttribute('data-state', 'closed');

		(trigger as HTMLButtonElement).focus();
		await userEvent.keyboard('{Enter}');

		await waitFor(() => {
			expect(trigger).toHaveAttribute('data-state', 'open');
		});

		await userEvent.keyboard(' ');

		await waitFor(() => {
			expect(trigger).toHaveAttribute('data-state', 'closed');
		});
	};
</script>

<Story name="Default Closed [play: click opens]" play={playClickOpens}>
	{#snippet template()}
		<div class="w-80">
			<Collapsible.Root>
				<Collapsible.Trigger
					class="flex w-full items-center justify-between rounded-md px-4 py-2 text-sm font-medium hover:bg-accent"
				>
					Toggle Section
				</Collapsible.Trigger>
				<Collapsible.Content>
					<div class="px-4 py-2 text-sm">
						This content is revealed when the collapsible is opened.
					</div>
				</Collapsible.Content>
			</Collapsible.Root>
		</div>
	{/snippet}
</Story>

<Story name="Default Open [play: click closes]" play={playClickCloses}>
	{#snippet template()}
		<div class="w-80">
			<Collapsible.Root open={true}>
				<Collapsible.Trigger
					class="flex w-full items-center justify-between rounded-md px-4 py-2 text-sm font-medium hover:bg-accent"
				>
					Toggle Section
				</Collapsible.Trigger>
				<Collapsible.Content>
					<div class="px-4 py-2 text-sm">
						This content starts visible and can be collapsed.
					</div>
				</Collapsible.Content>
			</Collapsible.Root>
		</div>
	{/snippet}
</Story>

<Story name="Disabled [play: disabled no change]" play={playDisabledNoChange}>
	{#snippet template()}
		<div class="w-80">
			<Collapsible.Root disabled>
				<Collapsible.Trigger
					class="flex w-full items-center justify-between rounded-md px-4 py-2 text-sm font-medium opacity-50"
				>
					Disabled Section
				</Collapsible.Trigger>
				<Collapsible.Content>
					<div class="px-4 py-2 text-sm">This content should not be reachable.</div>
				</Collapsible.Content>
			</Collapsible.Root>
		</div>
	{/snippet}
</Story>

<Story name="Keyboard Navigation [play: keyboard toggle]" play={playKeyboardToggle}>
	{#snippet template()}
		<div class="w-80">
			<StoryKeyboardHints>
				<KeyboardHint keys="Enter / Space" action="Toggle content" />
			</StoryKeyboardHints>
			<Collapsible.Root>
				<Collapsible.Trigger
					class="flex w-full items-center justify-between rounded-md px-4 py-2 text-sm font-medium hover:bg-accent"
				>
					Keyboard Toggle
				</Collapsible.Trigger>
				<Collapsible.Content>
					<div class="px-4 py-2 text-sm">
						Press Enter or Space on the trigger to toggle this content.
					</div>
				</Collapsible.Content>
			</Collapsible.Root>
		</div>
	{/snippet}
</Story>
