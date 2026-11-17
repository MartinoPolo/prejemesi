<!-- Hosts GiftDetailForm in the editor's open scroll-layout dialog with the wishlist page
     contexts, as GiftDetailModal does: its header, body and footer are Dialog parts and its
     preview renders the real Card and List row. -->
<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import * as Dialog from '$lib/components/base/dialog/index.js';
	import { setGiftsContext } from '$lib/modules/gifts/gifts.context.svelte.js';
	import { setLikesContext } from '$lib/modules/likes/likes.context.svelte.js';
	import GiftDetailForm from './GiftDetailForm.svelte';
	import { giftDetailModalVariants } from './gift_detail_modal_variants.js';

	let formProps: ComponentProps<typeof GiftDetailForm> = $props();

	setGiftsContext(
		() => formProps.wishlistId,
		() => (formProps.gift != null ? [formProps.gift] : []),
		() => formProps.role,
		() => false,
		() => true,
		() => [],
	);
	setLikesContext(
		() => [],
		() => true,
		() => {},
	);
</script>

<Dialog.Root open>
	<Dialog.Content class={giftDetailModalVariants().content()} layout="scroll">
		<Dialog.Description class="sr-only">Gift editor</Dialog.Description>
		<GiftDetailForm {...formProps} />
	</Dialog.Content>
</Dialog.Root>
