<script module lang="ts">
	import type { ComponentProps } from 'svelte';
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, userEvent, within } from 'storybook/test';
	import StoryKeyboardHints from '$lib/storybook/StoryKeyboardHints.svelte';
	import KeyboardHint from '$lib/storybook/KeyboardHint.svelte';
	import * as SegmentedToggle from './index.js';
	import { SEGMENTED_TOGGLE_PRESENTATIONS } from './index.js';

	type SegmentedToggleArgs = Partial<
		Omit<
			ComponentProps<typeof SegmentedToggle.Root>,
			'children' | 'value' | 'onValueChange' | 'onReselect'
		>
	>;

	const { Story } = defineMeta({
		title: 'Derived/SegmentedToggle',
		component: SegmentedToggle.Root,
		tags: ['autodocs'],
		argTypes: {
			presentation: { control: 'select', options: [...SEGMENTED_TOGGLE_PRESENTATIONS] },
		},
	});

	const playKeyboardAndFocus = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const radios = within(canvasElement).getAllByRole('radio');
		radios[0].focus();
		await expect(radios[0]).toHaveFocus();
		await userEvent.keyboard('{ArrowRight}');
		await expect(radios[1]).toHaveFocus();
		await userEvent.keyboard(' ');
		await expect(radios[1]).toHaveAttribute('aria-checked', 'true');
		await userEvent.click(radios[1]);
		await expect(
			radios.filter((radio) => radio.getAttribute('aria-checked') === 'true'),
		).toHaveLength(1);
	};
</script>

<script lang="ts">
	import LayoutGridIcon from '@lucide/svelte/icons/layout-grid';
	import ListIcon from '@lucide/svelte/icons/list';

	let exampleValue = $state('grid');
	let keyboardValue = $state('grid');
	let responsiveValue = $state('grid');
</script>

<Story name="All Variants">
	{#snippet template(args: SegmentedToggleArgs)}
		<div class="flex flex-col gap-4">
			{#each SEGMENTED_TOGGLE_PRESENTATIONS as presentation (presentation)}
				<div class="flex flex-col items-start gap-1.5">
					<span class="text-sm font-medium text-muted-foreground">{presentation}</span>
					<SegmentedToggle.Root
						{...args}
						value="grid"
						size="md"
						format="icon"
						aria-label={`${presentation} layout`}
						{presentation}
					>
						<SegmentedToggle.Item value="grid" aria-label={`${presentation} grid`}>
							<LayoutGridIcon />
						</SegmentedToggle.Item>
						<SegmentedToggle.Item value="list" aria-label={`${presentation} list`}>
							<ListIcon />
						</SegmentedToggle.Item>
					</SegmentedToggle.Root>
				</div>
			{/each}
		</div>
	{/snippet}
</Story>

<Story name="Selected, unselected, and disabled">
	{#snippet template(args: SegmentedToggleArgs)}
		<SegmentedToggle.Root
			bind:value={exampleValue}
			size="md"
			format="icon"
			aria-label="Layout"
			{...args}
		>
			<SegmentedToggle.Item value="grid" aria-label="Grid">
				<LayoutGridIcon />
			</SegmentedToggle.Item>
			<SegmentedToggle.Item value="list" aria-label="List">
				<ListIcon />
			</SegmentedToggle.Item>
			<SegmentedToggle.Item value="disabled" aria-label="Disabled layout" disabled>
				<ListIcon />
			</SegmentedToggle.Item>
		</SegmentedToggle.Root>
	{/snippet}
</Story>

<Story name="Focus and keyboard [play: arrow and space select]" play={playKeyboardAndFocus}>
	{#snippet template(args: SegmentedToggleArgs)}
		<StoryKeyboardHints>
			<KeyboardHint keys="→" action="Move focus to the next item" />
			<KeyboardHint keys="Space" action="Select the focused item" />
		</StoryKeyboardHints>
		<SegmentedToggle.Root
			bind:value={keyboardValue}
			size="md"
			format="icon"
			aria-label="Layout"
			{...args}
		>
			<SegmentedToggle.Item value="grid" aria-label="Grid">
				<LayoutGridIcon />
			</SegmentedToggle.Item>
			<SegmentedToggle.Item value="list" aria-label="List">
				<ListIcon />
			</SegmentedToggle.Item>
		</SegmentedToggle.Root>
	{/snippet}
</Story>

<Story name="Responsive targets" parameters={{ viewport: { defaultViewport: 'mobile1' } }}>
	{#snippet template(args: SegmentedToggleArgs)}
		<div class="max-w-full p-3">
			<SegmentedToggle.Root
				bind:value={responsiveValue}
				size="md"
				format="icon"
				aria-label="Responsive layout"
				{...args}
			>
				<SegmentedToggle.Item value="grid" aria-label="Grid">
					<LayoutGridIcon />
				</SegmentedToggle.Item>
				<SegmentedToggle.Item value="list" aria-label="List">
					<ListIcon />
				</SegmentedToggle.Item>
			</SegmentedToggle.Root>
		</div>
	{/snippet}
</Story>
