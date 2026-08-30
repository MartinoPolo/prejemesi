<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import WishlistGiftDraggableWrapper from './WishlistGiftDraggableWrapper.svelte';

	/**
	 * Test-only harness: `WishlistGiftDraggableWrapper` takes a `children` snippet (the gift card or
	 * row). This stands in with a plain placeholder card so the wrapper can be rendered in isolation.
	 */
	type WrapperProps = Omit<ComponentProps<typeof WishlistGiftDraggableWrapper>, 'children'>;
	let props: WrapperProps = $props();
</script>

<WishlistGiftDraggableWrapper {...props}>
	<div data-testid="card-placeholder">
		Card
		<button type="button">Inner action</button>
	</div>
</WishlistGiftDraggableWrapper>
