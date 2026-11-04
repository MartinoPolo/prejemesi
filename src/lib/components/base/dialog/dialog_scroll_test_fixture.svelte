<script lang="ts">
	import '../../../../app.css';
	import * as Dialog from './index.js';

	// fallow misses the read inside the `{#each { length: paragraphCount }}` object literal.
	// fallow-ignore-next-line unused-component-prop
	let { paragraphCount, divided = false }: { paragraphCount: number; divided?: boolean } =
		$props();
</script>

<Dialog.Root open>
	<Dialog.Content layout="scroll">
		<Dialog.Header {divided}>
			<Dialog.Title>Scrolling dialog</Dialog.Title>
			<Dialog.Description>Description</Dialog.Description>
		</Dialog.Header>
		<form onsubmit={(event) => event.preventDefault()}>
			<Dialog.Body>
				{#each { length: paragraphCount }, index (index)}
					<p>Paragraph {index + 1}</p>
				{/each}
			</Dialog.Body>
			<Dialog.Footer>
				<button type="button">Cancel</button>
				<button type="submit">Save</button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
