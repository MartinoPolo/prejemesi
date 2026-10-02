<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import type { GiftStateOverlayModel } from '$lib/modules/gifts/gift_display_state.js';
	import GiftStateOverlay from './GiftStateOverlay.svelte';

	const { Story } = defineMeta({
		title: 'Blocks/Gift/GiftStateOverlay',
		component: GiftStateOverlay,
		tags: ['autodocs'],
	});

	const STATE_MODELS: GiftStateOverlayModel[] = [
		{ kind: 'own-reservation' },
		{ kind: 'own-purchased' },
		{ kind: 'unavailable' },
		{ kind: 'unavailable', otherReservers: { kind: 'single', name: 'Jana' } },
		{ kind: 'unavailable', otherReservers: { kind: 'multiple' } },
		{ kind: 'partial', remaining: 2, total: 3 },
		{ kind: 'partial', supportKind: 'own-reservation', remaining: 1, total: 3 },
		{ kind: 'received', supportKind: 'unavailable' },
	];
</script>

<Story name="All States">
	{#snippet template()}
		<div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
			{#each STATE_MODELS as model, index (index)}
				<div class="relative aspect-square rounded-panel border-2 border-ink bg-muted">
					<GiftStateOverlay {model} />
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
			<GiftStateOverlay model={{ kind: 'received', supportKind: 'own-purchased' }} />
		</div>
	{/snippet}
</Story>
