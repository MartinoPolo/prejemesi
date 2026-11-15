<script lang="ts">
	import LazyDialog from './LazyDialog.svelte';
	import type { LazyComponent } from './lazy_component.svelte.js';
	import type LoadedDialogFixture from './LoadedDialogFixture.svelte';

	let {
		open = $bindable(false),
		loader,
	}: { open: boolean; loader: LazyComponent<typeof LoadedDialogFixture> } = $props();
</script>

<span data-testid="host-open">{open}</span>
<LazyDialog {open} {loader}>
	{#snippet children(LoadedDialog)}
		<LoadedDialog bind:open title="Nastavení" />
	{/snippet}
</LazyDialog>
