<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, userEvent, within } from 'storybook/test';
	import * as SegmentedToggle from './index.js';

	const { Story } = defineMeta({
		title: 'Derived/SegmentedToggle',
		component: SegmentedToggle.Root,
		tags: ['autodocs'],
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

<Story name="Selected, unselected, and disabled">
	{#snippet template()}
		<SegmentedToggle.Root bind:value={exampleValue} size="icon" aria-label="Layout">
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

<Story name="Focus and keyboard" play={playKeyboardAndFocus}>
	{#snippet template()}
		<SegmentedToggle.Root bind:value={keyboardValue} size="icon" aria-label="Layout">
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
	{#snippet template()}
		<div class="max-w-full p-3">
			<SegmentedToggle.Root
				bind:value={responsiveValue}
				size="icon"
				aria-label="Responsive layout"
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
