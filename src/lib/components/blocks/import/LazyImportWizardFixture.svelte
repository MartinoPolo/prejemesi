<script lang="ts">
	let {
		open = $bindable(false),
		mode,
		wishlistId,
		wishlistTitle,
		existingGifts = [],
		onsuccess,
	}: {
		open: boolean;
		mode: string;
		wishlistId?: string;
		wishlistTitle?: string;
		existingGifts?: Array<{ name: string }>;
		onsuccess?: () => void;
	} = $props();
</script>

{#if open}
	<div data-testid="loaded-import-wizard">
		<span>{mode}|{wishlistId}|{wishlistTitle}|{existingGifts[0]?.name}</span>
		<button onclick={() => onsuccess?.()}>succeed</button>
		<button onclick={() => (open = false)}>close</button>
	</div>
{/if}
