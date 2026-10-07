<script lang="ts">
	import '../../../../app.css';
	import * as Dialog from './index.js';

	let { title, showCloseButton = true }: { title: string; showCloseButton?: boolean } = $props();
</script>

<Dialog.Root open>
	<Dialog.Content size="sm" {showCloseButton}>
		<Dialog.Header>
			<Dialog.Title>{title}</Dialog.Title>
			<Dialog.Description>Description</Dialog.Description>
		</Dialog.Header>
	</Dialog.Content>
</Dialog.Root>
