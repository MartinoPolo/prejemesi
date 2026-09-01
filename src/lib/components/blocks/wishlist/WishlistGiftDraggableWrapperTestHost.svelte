<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import WishlistGiftDraggableWrapper from './WishlistGiftDraggableWrapper.svelte';
	import * as ContextMenu from '$lib/components/base/context-menu/index.js';

	/**
	 * Test-only harness: `WishlistGiftDraggableWrapper` takes a `children` snippet (the gift card or
	 * row). This stands in with a plain placeholder card so the wrapper can be rendered in isolation.
	 */
	type WrapperProps = Omit<ComponentProps<typeof WishlistGiftDraggableWrapper>, 'children'>;
	let props: WrapperProps = $props();
</script>

<ContextMenu.Root>
	<WishlistGiftDraggableWrapper {...props}>
		<div data-testid="card-placeholder">
			Card
			<button type="button" data-testid="inner-button">Inner action</button>
		</div>
	</WishlistGiftDraggableWrapper>
</ContextMenu.Root>
