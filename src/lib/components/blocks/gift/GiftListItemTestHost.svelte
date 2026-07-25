<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import { setLikesContext } from '$lib/modules/likes/likes.context.svelte.js';
	import { setGiftsContext } from '$lib/modules/gifts/gifts.context.svelte.js';
	import GiftListItem from './GiftListItem.svelte';

	/** Test/story-only harness — see GiftCardTestHost.svelte for why this is needed. */
	let props: ComponentProps<typeof GiftListItem> = $props();

	setLikesContext(
		() => [],
		() => true,
		() => {},
	);
	setGiftsContext(
		() => [props.gift],
		() => props.role,
		() => props.isArchived ?? false,
		() => true,
		() => [],
	);
</script>

<GiftListItem {...props} />
