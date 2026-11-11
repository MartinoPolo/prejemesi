<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, fn, userEvent, within } from 'storybook/test';
	import * as Alert from '$lib/components/base/alert/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import DangerActionCard from './DangerActionCard.svelte';

	const onDelete = fn();

	const { Story } = defineMeta({
		title: 'Blocks/Settings/DangerActionCard',
		component: DangerActionCard,
		tags: ['autodocs'],
	});
</script>

<Story
	name="Named Action"
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole('button', { name: 'Smazat seznam' }));
		await expect(onDelete).toHaveBeenCalledOnce();
	}}
>
	{#snippet template()}
		<div class="max-w-lg">
			<DangerActionCard
				icon={TriangleAlertIcon}
				title="Nebezpečná zóna"
				description="Nevratné akce s tímto seznamem."
				actionTitle="Smazat seznam"
				actionDescription="Seznam i všechny dárky budou trvale odstraněny."
				elevation="flat"
			>
				{#snippet action()}
					<Button intent="danger" size="sm" onclick={onDelete}>
						<TrashIcon data-icon="inline-start" />
						Smazat seznam
					</Button>
				{/snippet}
			</DangerActionCard>
		</div>
	{/snippet}
</Story>

<Story name="Blocked With Notice">
	{#snippet template()}
		<div class="max-w-lg">
			<DangerActionCard
				icon={RotateCcwIcon}
				title="Vrátit do konceptu"
				description="Seznam přestane být sdílený a vrátí se do konceptu."
				elevation="flat"
			>
				{#snippet notice()}
					<Alert.Root tone="warning">
						<TriangleAlertIcon />
						<Alert.Description>
							Seznam už má rezervace, vrácení může provést jen administrátor.
						</Alert.Description>
					</Alert.Root>
				{/snippet}
				{#snippet action()}
					<Button intent="danger" size="sm" disabled>
						<RotateCcwIcon data-icon="inline-start" />
						Vrátit do konceptu
					</Button>
				{/snippet}
			</DangerActionCard>
		</div>
	{/snippet}
</Story>
