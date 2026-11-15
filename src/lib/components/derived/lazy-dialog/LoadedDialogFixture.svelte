<script lang="ts">
	let { open = $bindable(false), title }: { open: boolean; title: string } = $props();
</script>

<div data-testid="loaded-dialog" data-open={open}>
	<span>{title}</span>
	<button onclick={() => (open = false)}>close</button>
</div>
