<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test';
	import { OverflowChips } from './index.js';

	const { Story } = defineMeta({
		title: 'Derived/OverflowChips',
		component: OverflowChips,
		tags: ['autodocs'],
	});

	const categories = [
		{ id: 'books', label: 'Knihy' },
		{ id: 'games', label: 'Hry' },
		{ id: 'sport', label: 'Sport' },
		{ id: 'kitchen', label: 'Kuchyně' },
	];

	const pressBeneath = fn();

	const playOpensOnClickOnly = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement);
		const trigger = canvas.getByRole('button', { name: 'Další kategorie: 3' });
		await expect(trigger).toHaveAttribute('data-prevent-gift-card-open');

		await userEvent.hover(trigger);
		await expect(screen.queryByRole('dialog', { name: 'Všechny kategorie' })).toBeNull();

		await userEvent.click(trigger);
		const popover = await screen.findByRole('dialog', { name: 'Všechny kategorie' });
		await expect(within(popover).getAllByRole('listitem')).toHaveLength(categories.length);

		pressBeneath.mockClear();
		await userEvent.click(canvas.getByRole('button', { name: 'Beneath' }));
		await waitFor(() =>
			expect(screen.queryByRole('dialog', { name: 'Všechny kategorie' })).toBeNull(),
		);
		await expect(pressBeneath).not.toHaveBeenCalled();
	};
</script>

<script lang="ts">
	import { Badge } from '$lib/components/base/badge/index.js';
	import { Button } from '$lib/components/base/button/index.js';
</script>

{#snippet categoryChip(category: (typeof categories)[number])}
	<Badge tone="primary">{category.label}</Badge>
{/snippet}

<Story name="Inline" play={playOpensOnClickOnly}>
	{#snippet template()}
		<div class="flex flex-col items-start gap-6">
			<OverflowChips
				items={categories}
				visibleCount={1}
				itemKey={(category) => category.id}
				itemLabel={(category) => category.label}
				chip={categoryChip}
				moreLabel={(hiddenCount) => `Další kategorie: ${hiddenCount}`}
				popoverTitle="Všechny kategorie"
			/>
			<Button intent="outline" size="sm" onclick={pressBeneath}>Beneath</Button>
		</div>
	{/snippet}
</Story>

<Story name="Stacked And Static">
	{#snippet template()}
		<div class="flex w-40 flex-col gap-6">
			<OverflowChips
				items={categories}
				visibleCount={1}
				layout="stacked"
				itemKey={(category) => category.id}
				itemLabel={(category) => category.label}
				chip={categoryChip}
				moreLabel={(hiddenCount) => `Další kategorie: ${hiddenCount}`}
				popoverTitle="Všechny kategorie"
			/>
			<OverflowChips
				items={categories}
				visibleCount={2}
				interactive={false}
				dimmed
				itemKey={(category) => category.id}
				itemLabel={(category) => category.label}
				chip={categoryChip}
				moreLabel={(hiddenCount) => `Další kategorie: ${hiddenCount}`}
				popoverTitle="Všechny kategorie"
			/>
		</div>
	{/snippet}
</Story>
