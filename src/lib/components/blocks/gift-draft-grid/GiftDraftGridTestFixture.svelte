<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import GiftDraftGrid from './GiftDraftGrid.svelte';

	let {
		initialRows,
		gate,
		awaitGate,
	}: {
		initialRows: ComponentProps<typeof GiftDraftGrid>['initialRows'];
		gate: { value: number };
		awaitGate: (value: number) => Promise<number>;
	} = $props();
</script>

<GiftDraftGrid {initialRows} />
<!-- A gate change pending here holds back every commit batched with it, as async work does in the app. -->
<svelte:boundary>
	<output data-testid="draft-grid-gate">{await awaitGate(gate.value)}</output>
	{#snippet pending()}{/snippet}
</svelte:boundary>
