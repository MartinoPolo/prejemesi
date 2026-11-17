<script lang="ts">
	import '../../../../app.css';
	import type { Snippet } from 'svelte';
	import * as Dialog from './index.js';

	let { title, onBack, lead }: { title: string; onBack?: () => void; lead?: Snippet } = $props();
</script>

<Dialog.Root open>
	<Dialog.Content size="sm">
		<Dialog.Header>
			{#if onBack}
				<Dialog.Back label="Back" onclick={onBack} />
			{/if}
			<Dialog.Title>{title}</Dialog.Title>
			<Dialog.Description>Description</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer {lead}>
			<button type="button">Cancel</button>
			<button type="button">Save</button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
