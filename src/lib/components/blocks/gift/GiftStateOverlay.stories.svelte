<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import type { GiftOverlayEntry } from '$lib/modules/gifts/gift_display_state.js';
	import GiftStateOverlay from './GiftStateOverlay.svelte';

	const { Story } = defineMeta({
		title: 'Blocks/Gift/GiftStateOverlay',
		component: GiftStateOverlay,
		tags: ['autodocs'],
	});

	const STATE_GROUPS: GiftOverlayEntry[][] = [
		[{ kind: 'own-reservation', role: 'primary' }],
		[{ kind: 'own-purchased', role: 'primary' }],
		[{ kind: 'unavailable', role: 'primary' }],
		[
			{
				kind: 'unavailable',
				otherReservers: { kind: 'single', name: 'Jana' },
				role: 'primary',
			},
		],
		[{ kind: 'unavailable', otherReservers: { kind: 'multiple' }, role: 'primary' }],
		[{ kind: 'partial', remaining: 2, total: 3, role: 'primary' }],
		[
			{ kind: 'own-reservation', role: 'primary' },
			{ kind: 'partial', remaining: 1, total: 3, role: 'support' },
			{
				kind: 'unavailable',
				otherReservers: { kind: 'multiple' },
				role: 'other-reservation',
			},
		],
		[
			{ kind: 'received', role: 'primary' },
			{ kind: 'unavailable', role: 'support' },
		],
	];
</script>

<Story name="All States">
	{#snippet template()}
		<div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
			{#each STATE_GROUPS as entries, index (index)}
				<div class="relative aspect-square rounded-panel border-2 border-ink bg-muted">
					<GiftStateOverlay {entries} />
				</div>
			{/each}
		</div>
	{/snippet}
</Story>

<Story name="Narrow Image">
	{#snippet template()}
		<div
			class="relative aspect-square w-36 rounded-panel border-2 border-ink bg-muted @container"
		>
			<GiftStateOverlay
				entries={[
					{ kind: 'received', role: 'primary' },
					{ kind: 'own-purchased', role: 'support' },
				]}
			/>
		</div>
	{/snippet}
</Story>
