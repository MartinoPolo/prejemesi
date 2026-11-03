<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, within } from 'storybook/test';
	import { SPINNER_SIZES, Spinner } from './index.js';

	const { Story } = defineMeta({
		title: 'Base/Spinner',
		component: Spinner,
		tags: ['autodocs'],
		argTypes: {
			size: { control: 'select', options: [...SPINNER_SIZES] },
		},
	});

	const playAccessibleName = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByRole('img', { name: 'Loading gifts' })).toBeInTheDocument();
		const decorativeSpinners = canvasElement.querySelectorAll(
			'[data-slot="spinner"][aria-hidden="true"]',
		);
		await expect(decorativeSpinners.length).toBe(SPINNER_SIZES.length + 1);
	};
</script>

<script lang="ts">
	import { Button } from '$lib/components/base/button/index.js';
</script>

<Story name="Sizes And Labels" play={playAccessibleName}>
	{#snippet template(args)}
		<div class="flex flex-col gap-4">
			<div class="flex items-center gap-4">
				{#each SPINNER_SIZES as size (size)}
					<div class="flex flex-col items-center gap-1">
						<Spinner {...args} {size} />
						<span class="text-xs text-muted-foreground">{size}</span>
					</div>
				{/each}
			</div>
			<div class="flex items-center gap-2 text-sm text-muted-foreground">
				<Spinner label="Loading gifts" />
				Labelled, for a spinner that stands alone
			</div>
			<Button disabled>
				<Spinner data-icon="inline-start" />
				Saving…
			</Button>
		</div>
	{/snippet}
</Story>
