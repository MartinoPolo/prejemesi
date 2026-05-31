<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, userEvent, waitFor, within } from 'storybook/test';
	import * as Popover from './index.js';
	import { Checkbox } from '$lib/components/base/checkbox/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Kbd, KbdGroup } from '$lib/components/base/kbd/index.js';
	import FilterIcon from '@lucide/svelte/icons/filter';
	import LayersIcon from '@lucide/svelte/icons/layers';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import CheckIcon from '@lucide/svelte/icons/check';
	import CornerDownLeftIcon from '@lucide/svelte/icons/corner-down-left';
	import StoryKeyboardHints from '$lib/storybook/StoryKeyboardHints.svelte';
	import KeyboardHint from '$lib/storybook/KeyboardHint.svelte';

	const { Story } = defineMeta({
		title: 'Base/Popover',
		component: Popover.Root,
		tags: ['autodocs'],
	});

	/** Helper: find popover content inside the canvas (portal disabled in stories). */
	function getPopoverContent(canvas: HTMLElement): HTMLElement | null {
		return canvas.querySelector('[data-slot="popover-content"]');
	}

	/** Helper: assert popover content is closed (either absent or data-state="closed"). */
	async function expectPopoverClosed(canvas: HTMLElement) {
		const content = getPopoverContent(canvas);
		if (content) {
			await waitFor(() => expect(content.dataset.state).toBe('closed'));
			return;
		}
	}

	/** Click trigger -> popover opens, Escape -> popover closes. */
	const playOpenAndEscapeClose = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement);
		const trigger = canvas.getByRole('button', { name: /filter/i });

		// Popover starts closed
		await expectPopoverClosed(canvasElement);

		// Click trigger -> opens
		await userEvent.click(trigger);
		const content = getPopoverContent(canvasElement);
		await expect(content).not.toBeNull();
		await expect(content).toHaveAttribute('data-state', 'open');

		// Escape -> closes
		await userEvent.keyboard('{Escape}');
		await expectPopoverClosed(canvasElement);
	};

	/** Popover starts open, click outside -> popover closes. */
	const playClickOutsideCloses = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		// "Open by Default" story starts with the popover already open
		await expect(getPopoverContent(canvasElement)).not.toBeNull();

		// Click outside the popover (on the canvas wrapper)
		await userEvent.click(canvasElement);
		await expectPopoverClosed(canvasElement);
	};

	/** Click a sort item -> data-state="active" updates, click another -> previous deactivates. */
	const playSortItemSelection = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement);
		const trigger = canvas.getByRole('button', { name: /sort by/i });

		// Open popover
		await userEvent.click(trigger);
		const content = getPopoverContent(canvasElement)!;

		// "Updated · newest" is active by default
		const items = [...content.querySelectorAll('[role="menuitem"]')] as HTMLElement[];
		await expect(items[0]).toHaveAttribute('data-state', 'active'); // Updated · newest

		// Click "Created · newest"
		await userEvent.click(items[1]);
		await expect(items[1]).toHaveAttribute('data-state', 'active');
		await expect(items[0]).not.toHaveAttribute('data-state', 'active');
	};

	/** Escape closes popover and trigger remains accessible (containment test). */
	const playEscapeContainment = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement);
		const trigger = canvas.getByRole('button', { name: /legend/i });

		// Open popover
		await userEvent.click(trigger);
		await expect(getPopoverContent(canvasElement)).not.toBeNull();

		// Press Escape — should close popover
		await userEvent.keyboard('{Escape}');
		await expectPopoverClosed(canvasElement);

		// Trigger should remain in the DOM (parent layer not dismissed)
		await expect(trigger).toBeVisible();
	};
</script>

<script lang="ts">
	// Reactive state for Sort story — selecting sort/group values updates checkmarks
	let sortBy = $state('updated');
	let groupBy = $state('repository');
</script>

<Story name="Filter [play: open and escape close]" play={playOpenAndEscapeClose}>
	{#snippet template()}
		<StoryKeyboardHints>
			<KeyboardHint keys="Escape" action="Close popover" />
		</StoryKeyboardHints>
		<div class="flex items-start gap-4 p-4">
			<Popover.Root>
				<Popover.Trigger>
					{#snippet child({ props })}
						<Button intent="secondary" {...props}>
							<FilterIcon data-icon="inline-start" />
							Filter
						</Button>
					{/snippet}
				</Popover.Trigger>
				<Popover.Content class="w-60" portalProps={{ disabled: true }}>
					<Popover.Label>Status</Popover.Label>
					<label
						class="flex min-h-7 cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-(length:--text-sm) hover:bg-secondary"
					>
						<Checkbox checked />
						Running
					</label>
					<label
						class="flex min-h-7 cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-(length:--text-sm) hover:bg-secondary"
					>
						<Checkbox checked />
						PR draft
					</label>
					<label
						class="flex min-h-7 cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-(length:--text-sm) hover:bg-secondary"
					>
						<Checkbox />
						Approved
					</label>
					<label
						class="flex min-h-7 cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-(length:--text-sm) hover:bg-secondary"
					>
						<Checkbox />
						Merged
					</label>
					<Popover.Divider />
					<Popover.Label>Provider</Popover.Label>
					<label
						class="flex min-h-7 cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-(length:--text-sm) hover:bg-secondary"
					>
						<Checkbox checked />
						Claude
					</label>
					<label
						class="flex min-h-7 cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-(length:--text-sm) hover:bg-secondary"
					>
						<Checkbox />
						Codex
					</label>
					<Popover.Divider />
					<!-- Keyboard hints: Enter = Apply, Ctrl+R = Reset. Tab/Space on checkboxes handled by bits-ui. -->
					<div class="flex gap-1.5 px-1 pb-1 pt-0.5">
						<Button intent="ghost" size="sm" class="flex-1">
							<KbdGroup><Kbd>Ctrl</Kbd><Kbd>R</Kbd></KbdGroup>
							Reset
						</Button>
						<Button intent="primary" size="sm" class="flex-1">
							Apply
							<Kbd format="lucide" tone="inverted"><CornerDownLeftIcon /></Kbd>
						</Button>
					</div>
				</Popover.Content>
			</Popover.Root>
		</div>
	{/snippet}
</Story>

<Story name="Sort [play: sort item selection]" play={playSortItemSelection}>
	{#snippet template()}
		<div class="flex items-start gap-4 p-4">
			<Popover.Root>
				<Popover.Trigger>
					{#snippet child({ props })}
						<Button intent="secondary" {...props}>
							<LayersIcon data-icon="inline-start" />
							Sort by
						</Button>
					{/snippet}
				</Popover.Trigger>
				<Popover.Content class="w-55" portalProps={{ disabled: true }}>
					<Popover.Label>Sort by</Popover.Label>
					<Popover.Item
						active={sortBy === 'updated'}
						onclick={() => (sortBy = 'updated')}
					>
						{#if sortBy === 'updated'}<CheckIcon class="size-2.75" />{:else}<span
								class="size-2.75"
							></span>{/if}
						Updated · newest
					</Popover.Item>
					<Popover.Item
						active={sortBy === 'created'}
						onclick={() => (sortBy = 'created')}
					>
						{#if sortBy === 'created'}<CheckIcon class="size-2.75" />{:else}<span
								class="size-2.75"
							></span>{/if}
						Created · newest
					</Popover.Item>
					<Popover.Item active={sortBy === 'number'} onclick={() => (sortBy = 'number')}>
						{#if sortBy === 'number'}<CheckIcon class="size-2.75" />{:else}<span
								class="size-2.75"
							></span>{/if}
						Issue # · ascending
					</Popover.Item>
					<Popover.Item active={sortBy === 'stage'} onclick={() => (sortBy = 'stage')}>
						{#if sortBy === 'stage'}<CheckIcon class="size-2.75" />{:else}<span
								class="size-2.75"
							></span>{/if}
						Tree stage
					</Popover.Item>
					<Popover.Item
						active={sortBy === 'provider'}
						onclick={() => (sortBy = 'provider')}
					>
						{#if sortBy === 'provider'}<CheckIcon class="size-2.75" />{:else}<span
								class="size-2.75"
							></span>{/if}
						Provider
					</Popover.Item>
					<Popover.Divider />
					<Popover.Label>Group by</Popover.Label>
					<Popover.Item active={groupBy === 'none'} onclick={() => (groupBy = 'none')}>
						{#if groupBy === 'none'}<CheckIcon class="size-2.75" />{:else}<span
								class="size-2.75"
							></span>{/if}
						None
					</Popover.Item>
					<Popover.Item
						active={groupBy === 'repository'}
						onclick={() => (groupBy = 'repository')}
					>
						{#if groupBy === 'repository'}<CheckIcon class="size-2.75" />{:else}<span
								class="size-2.75"
							></span>{/if}
						Repository
					</Popover.Item>
					<Popover.Item
						active={groupBy === 'status'}
						onclick={() => (groupBy = 'status')}
					>
						{#if groupBy === 'status'}<CheckIcon class="size-2.75" />{:else}<span
								class="size-2.75"
							></span>{/if}
						Status
					</Popover.Item>
				</Popover.Content>
			</Popover.Root>
		</div>
	{/snippet}
</Story>

<Story name="Legend [play: escape containment]" play={playEscapeContainment}>
	{#snippet template()}
		<StoryKeyboardHints>
			<KeyboardHint keys="Escape" action="Close popover" />
		</StoryKeyboardHints>
		<div class="flex items-start gap-4 p-4">
			<Popover.Root>
				<Popover.Trigger>
					{#snippet child({ props })}
						<Button intent="secondary" {...props}>
							<SparklesIcon data-icon="inline-start" />
							Legend
						</Button>
					{/snippet}
				</Popover.Trigger>
				<Popover.Content class="w-60" portalProps={{ disabled: true }}>
					<Popover.Label>Status legend</Popover.Label>
					<div class="grid gap-1.5 px-2 pb-1.5">
						{#each [{ color: 'bg-[oklch(0.69_0.098_132)]', label: 'Active — in progress' }, { color: 'bg-[oklch(0.77_0.15_65)]', label: 'Review — awaiting review' }, { color: 'bg-[#e8a8c0]', label: 'Approved — ready to merge' }, { color: 'bg-[#e8a64a]', label: 'Blocked — needs attention' }, { color: 'bg-muted-foreground', label: 'Closed — completed' }, { color: 'bg-destructive', label: 'Cancelled — abandoned' }] as entry (entry.label)}
							<div class="flex items-center gap-2">
								<span class="size-2 shrink-0 rounded-0.5 {entry.color}"></span>
								<span class="text-(length:--text-2xs) text-foreground"
									>{entry.label}</span
								>
							</div>
						{/each}
					</div>
				</Popover.Content>
			</Popover.Root>
		</div>
	{/snippet}
</Story>

<Story name="Open by Default [play: click outside closes]" play={playClickOutsideCloses}>
	{#snippet template()}
		<div class="flex items-start gap-4 p-4 pb-72">
			<Popover.Root open={true}>
				<Popover.Trigger>
					{#snippet child({ props })}
						<Button intent="secondary" {...props}>
							<FilterIcon data-icon="inline-start" />
							Filter
						</Button>
					{/snippet}
				</Popover.Trigger>
				<Popover.Content class="w-60" portalProps={{ disabled: true }}>
					<Popover.Label>Status</Popover.Label>
					<label
						class="flex min-h-7 cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-(length:--text-sm) hover:bg-secondary"
					>
						<Checkbox checked />
						Running
					</label>
					<label
						class="flex min-h-7 cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-(length:--text-sm) hover:bg-secondary"
					>
						<Checkbox checked />
						PR draft
					</label>
					<label
						class="flex min-h-7 cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-(length:--text-sm) hover:bg-secondary"
					>
						<Checkbox />
						Approved
					</label>
					<Popover.Divider />
					<div class="flex gap-1.5 px-1 pb-1 pt-0.5">
						<Button intent="ghost" size="sm" class="flex-1">
							<KbdGroup><Kbd>Ctrl</Kbd><Kbd>R</Kbd></KbdGroup>
							Reset
						</Button>
						<Button intent="primary" size="sm" class="flex-1">
							Apply
							<Kbd format="lucide" tone="inverted"><CornerDownLeftIcon /></Kbd>
						</Button>
					</div>
				</Popover.Content>
			</Popover.Root>
		</div>
	{/snippet}
</Story>

<Story name="All Open">
	{#snippet template()}
		<div class="flex items-start gap-8 p-8" style="min-height: 420px;">
			<!-- Filter popover open -->
			<Popover.Root open={true}>
				<Popover.Trigger>
					{#snippet child({ props })}
						<Button intent="secondary" {...props}>
							<FilterIcon data-icon="inline-start" />
							Filter
						</Button>
					{/snippet}
				</Popover.Trigger>
				<Popover.Content class="w-60" portalProps={{ disabled: true }}>
					<Popover.Label>Status</Popover.Label>
					<label
						class="flex min-h-7 cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-(length:--text-sm) hover:bg-secondary"
					>
						<Checkbox checked />
						Running
					</label>
					<label
						class="flex min-h-7 cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-(length:--text-sm) hover:bg-secondary"
					>
						<Checkbox checked />
						PR draft
					</label>
					<label
						class="flex min-h-7 cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-(length:--text-sm) hover:bg-secondary"
					>
						<Checkbox />
						Approved
					</label>
					<label
						class="flex min-h-7 cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-(length:--text-sm) hover:bg-secondary"
					>
						<Checkbox />
						Merged
					</label>
					<Popover.Divider />
					<Popover.Label>Provider</Popover.Label>
					<label
						class="flex min-h-7 cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-(length:--text-sm) hover:bg-secondary"
					>
						<Checkbox checked />
						Claude
					</label>
					<label
						class="flex min-h-7 cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-(length:--text-sm) hover:bg-secondary"
					>
						<Checkbox />
						Codex
					</label>
					<Popover.Divider />
					<div class="flex gap-1.5 px-1 pb-1 pt-0.5">
						<Button intent="ghost" size="sm" class="flex-1">
							<KbdGroup><Kbd>Ctrl</Kbd><Kbd>R</Kbd></KbdGroup>
							Reset
						</Button>
						<Button intent="primary" size="sm" class="flex-1">
							Apply
							<Kbd format="lucide" tone="inverted"><CornerDownLeftIcon /></Kbd>
						</Button>
					</div>
				</Popover.Content>
			</Popover.Root>

			<!-- Sort popover open -->
			<Popover.Root open={true}>
				<Popover.Trigger>
					{#snippet child({ props })}
						<Button intent="secondary" {...props}>
							<LayersIcon data-icon="inline-start" />
							Sort by
						</Button>
					{/snippet}
				</Popover.Trigger>
				<Popover.Content class="w-55" portalProps={{ disabled: true }}>
					<Popover.Label>Sort by</Popover.Label>
					<Popover.Item active>
						<CheckIcon class="size-2.75" />
						Updated · newest
					</Popover.Item>
					<Popover.Item>
						<span class="size-2.75"></span>
						Created · newest
					</Popover.Item>
					<Popover.Item>
						<span class="size-2.75"></span>
						Issue # · ascending
					</Popover.Item>
					<Popover.Item>
						<span class="size-2.75"></span>
						Tree stage
					</Popover.Item>
					<Popover.Item>
						<span class="size-2.75"></span>
						Provider
					</Popover.Item>
					<Popover.Divider />
					<Popover.Label>Group by</Popover.Label>
					<Popover.Item>
						<span class="size-2.75"></span>
						None
					</Popover.Item>
					<Popover.Item active>
						<CheckIcon class="size-2.75" />
						Repository
					</Popover.Item>
					<Popover.Item>
						<span class="size-2.75"></span>
						Status
					</Popover.Item>
				</Popover.Content>
			</Popover.Root>

			<!-- Legend popover open -->
			<Popover.Root open={true}>
				<Popover.Trigger>
					{#snippet child({ props })}
						<Button intent="secondary" {...props}>
							<SparklesIcon data-icon="inline-start" />
							Legend
						</Button>
					{/snippet}
				</Popover.Trigger>
				<Popover.Content class="w-60" portalProps={{ disabled: true }}>
					<Popover.Label>Status legend</Popover.Label>
					<div class="grid gap-1.5 px-2 pb-1.5">
						{#each [{ color: 'bg-[oklch(0.69_0.098_132)]', label: 'Active — in progress' }, { color: 'bg-[oklch(0.77_0.15_65)]', label: 'Review — awaiting review' }, { color: 'bg-[#e8a8c0]', label: 'Approved — ready to merge' }, { color: 'bg-[#e8a64a]', label: 'Blocked — needs attention' }, { color: 'bg-muted-foreground', label: 'Closed — completed' }, { color: 'bg-destructive', label: 'Cancelled — abandoned' }] as entry (entry.label)}
							<div class="flex items-center gap-2">
								<span class="size-2 shrink-0 rounded-0.5 {entry.color}"></span>
								<span class="text-(length:--text-2xs) text-foreground"
									>{entry.label}</span
								>
							</div>
						{/each}
					</div>
				</Popover.Content>
			</Popover.Root>
		</div>
	{/snippet}
</Story>
