<script lang="ts">
	import CheckIcon from '@lucide/svelte/icons/check';
	import { Button } from '$lib/components/base/button/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';
	import { canManageWishlist } from '$lib/modules/wishlists/wishlist_capabilities.js';

	interface Props {
		giftId: string;
		received: boolean;
		role: WishlistRole;
		isArchived?: boolean;
		size?: 'md' | 'sm';
		class?: string;
		onreceived?: (giftId: string, received: boolean) => void;
	}

	let {
		giftId,
		received,
		role,
		isArchived = false,
		size = 'md',
		class: className,
		onreceived,
	}: Props = $props();

	const visible = $derived(canManageWishlist(role) && !isArchived && onreceived !== undefined);

	function handleClick(event: MouseEvent) {
		event.stopPropagation();
		if (onreceived !== undefined) {
			onreceived(giftId, !received);
		}
	}
</script>

{#if visible}
	<Button
		{size}
		intent="primary"
		class={className}
		onclick={handleClick}
		data-testid="gift-received-toggle"
	>
		<CheckIcon data-icon="inline-start" />
		{received ? m.gift_mark_unreceived() : m.gift_mark_received()}
	</Button>
{/if}
