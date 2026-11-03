<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import * as ContextMenu from '$lib/components/base/context-menu/index.js';
	import * as Popover from '$lib/components/base/popover/index.js';
	import GiftCategoryBadges from '$lib/components/blocks/gift/GiftCategoryBadges.svelte';
	import type { PublicGiftCategory } from '$lib/modules/gift-categories/types.js';
	import WishlistGiftDraggableWrapper from './WishlistGiftDraggableWrapper.svelte';

	/**
	 * Test-only harness: a card wrapper whose content is a category lane that overflows into "+X",
	 * beside a page popover outside the card.
	 */
	type WrapperProps = Omit<ComponentProps<typeof WishlistGiftDraggableWrapper>, 'children'>;
	let { categories, ...props }: WrapperProps & { categories: PublicGiftCategory[] } = $props();
</script>

<ContextMenu.Root>
	<WishlistGiftDraggableWrapper {...props}>
		<div class="w-[220px] p-2" data-testid="card-placeholder">
			<GiftCategoryBadges {categories} />
		</div>
	</WishlistGiftDraggableWrapper>
</ContextMenu.Root>

<!-- Below the card, so the open popover never covers it. -->
<div class="mt-48">
	<Popover.Root>
		<Popover.Trigger>Page popover</Popover.Trigger>
		<Popover.Content data-testid="page-popover">Page popover content</Popover.Content>
	</Popover.Root>
</div>
