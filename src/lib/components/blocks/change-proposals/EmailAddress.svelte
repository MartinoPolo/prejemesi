<script lang="ts">
	/** An invitation address shown exactly, in full, so the reviewer can check every character. */
	let { address }: { address: string } = $props();
</script>

<code class="email">{address}</code>

<style>
	.email {
		padding: 0 5px;
		border: 1.5px solid var(--ink);
		border-radius: 5px;
		background: var(--card);
		font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace;
		font-weight: 600;
		overflow-wrap: anywhere;
	}
</style>
