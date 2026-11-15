<script lang="ts">
	let { open = $bindable(false), title }: { open: boolean; title: string } = $props();

	// Records the value the dialog mounted with.
	const mountedOpen = open;
</script>

<div data-testid="loaded-dialog" data-open={open} data-mounted-open={mountedOpen}>
	<span>{title}</span>
	<button onclick={() => (open = false)}>close</button>
</div>
