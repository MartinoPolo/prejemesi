<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import * as ContextMenu from '$lib/components/base/context-menu/index.js';
	import GiftContextActions from './GiftContextActions.svelte';
	let props: ComponentProps<typeof GiftContextActions> = $props();
</script>

<ContextMenu.Root open={props.open}>
	<ContextMenu.Trigger>Gift target</ContextMenu.Trigger>
	<GiftContextActions {...props} />
</ContextMenu.Root>
