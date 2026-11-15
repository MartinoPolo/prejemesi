<script lang="ts">
	import LazyDialog from './LazyDialog.svelte';
	import type { LazyComponent } from './lazy_component.svelte.js';
	import type LoadedDialogFixture from './LoadedDialogFixture.svelte';

	let {
		open = $bindable(false),
		loader,
		preloadWhenIdle = false,
		reloadPage,
	}: {
		open: boolean;
		loader: LazyComponent<typeof LoadedDialogFixture>;
		preloadWhenIdle?: boolean;
		reloadPage?: () => void;
	} = $props();
</script>

<button onclick={() => (open = true)}>trigger</button>
<span data-testid="host-open">{open}</span>
<LazyDialog bind:open {loader} {preloadWhenIdle} {reloadPage}>
	{#snippet children(LoadedDialog, dialog)}
		<LoadedDialog bind:open={dialog.open} title="Nastavení" />
	{/snippet}
</LazyDialog>
