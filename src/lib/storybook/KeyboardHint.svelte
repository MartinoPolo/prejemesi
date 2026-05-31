<script lang="ts">
	interface Props {
		keys: string;
		action: string;
	}

	const { keys, action }: Props = $props();

	const keyParts = $derived(keys.split(' / '));
</script>

<li>
	{#each keyParts as keyPart, i (i)}
		{#if i > 0}
			<span>/</span>
		{/if}
		<kbd class="rounded bg-muted px-1 font-mono text-xs">{keyPart}</kbd>
	{/each}
	<span>—</span>
	<span>{action}</span>
</li>
