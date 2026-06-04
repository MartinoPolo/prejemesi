<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { Button } from '$lib/components/base/button/index.js';
	import GiftDraftDialog from './GiftDraftDialog.svelte';

	const { Story } = defineMeta({
		title: 'Blocks/GiftDraftGrid/Dialog',
		component: GiftDraftDialog,
	});
</script>

<script lang="ts">
	let open = $state(false);
</script>

<Story name="Batch-add dialog">
	<Button onclick={() => (open = true)}>Hromadně přidat dárky</Button>
	<GiftDraftDialog bind:open />
</Story>
