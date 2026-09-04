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
		<div data-testid="card-placeholder" class="grid h-32 grid-cols-[128px_minmax(0,1fr)]">
			<div data-testid="image-placeholder" class="size-32">Image</div>
			<div>
				Card
				<button type="button" data-testid="inner-button">Inner action</button>
			</div>
		</div>
	</WishlistGiftDraggableWrapper>
</ContextMenu.Root>
