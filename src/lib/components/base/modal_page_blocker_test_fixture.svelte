<script lang="ts">
	import '../../../app.css';
	import * as Dialog from './dialog/index.js';
	import * as DropdownMenu from './dropdown-menu/index.js';
	import * as Select from './select/index.js';

	let {
		layer = 'menu',
		insideDialog = false,
	}: { layer?: 'menu' | 'select'; insideDialog?: boolean } = $props();
</script>

{#snippet modalLayer()}
	{#if layer === 'menu'}
		<DropdownMenu.Root open>
			<DropdownMenu.Trigger>Actions</DropdownMenu.Trigger>
			<DropdownMenu.Content>
				<DropdownMenu.Item>Edit</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	{:else}
		<Select.Root type="single" open>
			<Select.Trigger>Choice</Select.Trigger>
			<Select.Content>
				<Select.Item value="first" label="First">First</Select.Item>
			</Select.Content>
		</Select.Root>
	{/if}
{/snippet}

{#if insideDialog}
	<Dialog.Root open>
		<Dialog.Content size="sm">
			<Dialog.Title>Nested</Dialog.Title>
			<button type="button" data-testid="dialog-control">Dialog control</button>
			{@render modalLayer()}
		</Dialog.Content>
	</Dialog.Root>
{:else}
	{@render modalLayer()}
{/if}
