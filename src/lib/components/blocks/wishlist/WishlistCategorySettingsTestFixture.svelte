<script lang="ts">
	import WishlistCategorySettings from './WishlistCategorySettings.svelte';

	let {
		gate,
		awaitGate,
	}: { gate: { value: number }; awaitGate: (value: number) => Promise<number> } = $props();
</script>

<WishlistCategorySettings wishlistId="wishlist-1" />
<!-- A gate change pending here holds back every commit batched with it, as async work does in the app. -->
<svelte:boundary>
	<output data-testid="category-settings-gate">{await awaitGate(gate.value)}</output>
	{#snippet pending()}{/snippet}
</svelte:boundary>
