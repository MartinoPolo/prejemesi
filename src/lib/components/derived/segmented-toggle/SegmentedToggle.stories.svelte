<script module lang="ts">
	import type { ComponentProps } from 'svelte';
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, userEvent, within } from 'storybook/test';
	import StoryKeyboardHints from '$lib/storybook/StoryKeyboardHints.svelte';
	import KeyboardHint from '$lib/storybook/KeyboardHint.svelte';
	import * as SegmentedToggle from './index.js';
	import { SEGMENTED_TOGGLE_PRESENTATIONS } from './index.js';

	type SegmentedToggleArgs = Partial<
		Omit<ComponentProps<typeof SegmentedToggle.Root>, 'children' | 'value' | 'onValueChange'>
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

	const playTrayHugsOptions = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const tray = within(canvasElement).getByRole('group', { name: 'Image source' });
		const stretchingParent = tray.parentElement!;
		await expect(tray.getBoundingClientRect().width).toBeLessThan(
			stretchingParent.getBoundingClientRect().width / 2,
		);
	};

	const playOptionsShareContainer = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const tray = within(canvasElement).getByRole('group');
		const container = tray.parentElement!;
		const containerStyle = getComputedStyle(container);
		const containerContentWidth =
			container.clientWidth -
			parseFloat(containerStyle.paddingLeft) -
			parseFloat(containerStyle.paddingRight);
		await expect(
			Math.abs(tray.getBoundingClientRect().width - containerContentWidth),
		).toBeLessThan(1);
		const optionWidths = within(tray)
			.getAllByRole('radio')
			.map((option) => option.getBoundingClientRect().width);
		for (const optionWidth of optionWidths) {
			await expect(Math.abs(optionWidth - optionWidths[0])).toBeLessThan(1);
		}
		await expect(tray.scrollWidth).toBeLessThanOrEqual(tray.clientWidth);
	};
</script>

<script lang="ts">
	import ArrowUpDownIcon from '@lucide/svelte/icons/arrow-up-down';
	import LayersIcon from '@lucide/svelte/icons/layers';
	import LayoutGridIcon from '@lucide/svelte/icons/layout-grid';
	import ListFilterIcon from '@lucide/svelte/icons/list-filter';
	import ListIcon from '@lucide/svelte/icons/list';

	let exampleValue = $state('grid');
	let keyboardValue = $state('grid');
	let responsiveValue = $state('grid');
	let stretchingParentValue = $state('upload');
	let fillValue = $state('self');
	let tabBarValue = $state('filter');
	let motionValues = $state<Record<string, string>>(
		Object.fromEntries(
			SEGMENTED_TOGGLE_PRESENTATIONS.map((presentation) => [presentation, 'short']),
		),
	);
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

<Story name="Motion">
	{#snippet template(args: SegmentedToggleArgs)}
		<div class="flex flex-col items-start gap-4">
			{#each SEGMENTED_TOGGLE_PRESENTATIONS as presentation (presentation)}
				<SegmentedToggle.Root
					{...args}
					bind:value={motionValues[presentation]}
					size="md"
					aria-label={`${presentation} selection slide`}
					{presentation}
				>
					<SegmentedToggle.Item value="short">Card</SegmentedToggle.Item>
					<SegmentedToggle.Item value="long">List and reservations</SegmentedToggle.Item>
					<SegmentedToggle.Item value="middle">Compact</SegmentedToggle.Item>
				</SegmentedToggle.Root>
			{/each}
		</div>
	{/snippet}
</Story>

<Story name="Inside a stretching parent [play: tray hugs its options]" play={playTrayHugsOptions}>
	{#snippet template(args: SegmentedToggleArgs)}
		<div class="flex w-96 flex-col gap-1.5">
			<span class="text-sm font-medium text-muted-foreground">Image source</span>
			<SegmentedToggle.Root
				bind:value={stretchingParentValue}
				size="md"
				aria-label="Image source"
				{...args}
				presentation="default"
			>
				<SegmentedToggle.Item value="upload">Upload</SegmentedToggle.Item>
				<SegmentedToggle.Item value="link">Link</SegmentedToggle.Item>
			</SegmentedToggle.Root>
		</div>
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

<Story name="Fill width [play: options share the tray]" play={playOptionsShareContainer}>
	{#snippet template(args: SegmentedToggleArgs)}
		<div class="w-96">
			<SegmentedToggle.Root
				bind:value={fillValue}
				aria-label="Recipient"
				{...args}
				width="fill"
			>
				<SegmentedToggle.Item value="self">For me</SegmentedToggle.Item>
				<SegmentedToggle.Item value="other">For someone else</SegmentedToggle.Item>
			</SegmentedToggle.Root>
		</div>
	{/snippet}
</Story>

<!-- The mobile Display sheet switches its sections with a tab bar along the sheet's footer. -->
<Story name="Tab bar [play: options share the bar]" play={playOptionsShareContainer}>
	{#snippet template(args: SegmentedToggleArgs)}
		<div class="w-90 border-t border-border p-2">
			<SegmentedToggle.Root
				bind:value={tabBarValue}
				aria-label="Display section"
				{...args}
				presentation="tab-bar"
				width="fill"
			>
				<SegmentedToggle.Item value="sort">
					<ArrowUpDownIcon data-icon="inline-start" />Sort by
				</SegmentedToggle.Item>
				<SegmentedToggle.Item value="grouping">
					<LayersIcon data-icon="inline-start" />Grouping
				</SegmentedToggle.Item>
				<SegmentedToggle.Item value="filter">
					<ListFilterIcon data-icon="inline-start" />Filter
				</SegmentedToggle.Item>
			</SegmentedToggle.Root>
		</div>
	{/snippet}
</Story>
