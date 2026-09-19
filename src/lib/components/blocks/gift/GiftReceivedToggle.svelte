<script lang="ts">
	import { tick } from 'svelte';
	import CheckIcon from '@lucide/svelte/icons/check';
	import { Button } from '$lib/components/base/button/index.js';
	import type { ControlSize } from '$lib/components/base/control_sizing.js';
	import * as m from '$lib/paraglide/messages.js';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';
	import { canManageWishlist } from '$lib/modules/wishlists/wishlist_capabilities.js';

	interface Props {
		giftId: string;
		received: boolean;
		role: WishlistRole;
		isArchived?: boolean;
		size?: ControlSize;
		compactLabel?: boolean;
		pending?: boolean;
		class?: string;
		surfaceClass?: string;
		onreceived?: (giftId: string, received: boolean) => void | Promise<void>;
	}

	let {
		giftId,
		received,
		role,
		isArchived = false,
		size,
		compactLabel = false,
		pending = false,
		class: className,
		surfaceClass,
		onreceived,
	}: Props = $props();

	const visible = $derived(canManageWishlist(role) && !isArchived && onreceived !== undefined);
	let localPending = $state(false);
	const isPending = $derived(pending || localPending);
	let action: HTMLButtonElement | HTMLAnchorElement | null = $state(null);

	function focusTarget(): HTMLElement | null {
		if (action?.isConnected === true) {
			return action;
		}
		for (const candidate of document.querySelectorAll<HTMLElement>(
			'[data-gift-received-action]',
		)) {
			if (
				candidate.dataset.giftReceivedAction === giftId &&
				!candidate.matches(':disabled') &&
				candidate.closest('[inert], [aria-hidden="true"]') === null
			) {
				return candidate;
			}
		}
		return null;
	}

	async function handleClick(event: MouseEvent) {
		event.stopPropagation();
		if (onreceived === undefined || isPending) {
			return;
		}
		localPending = true;
		try {
			await onreceived(giftId, !received);
		} finally {
			localPending = false;
			await tick();
			focusTarget()?.focus({ preventScroll: true });
		}
	}
</script>

{#if visible}
	<Button
		bind:ref={action}
		{size}
		intent="secondary-filled"
		class={className}
		{surfaceClass}
		onclick={handleClick}
		disabled={isPending}
		aria-label={received ? m.gift_mark_unreceived() : m.gift_mark_received()}
		data-testid="gift-received-toggle"
		data-gift-received-action={giftId}
		data-pending={isPending}
	>
		<CheckIcon data-icon="inline-start" />
		{#if compactLabel}
			{received ? m.gift_unreceived_compact() : m.gift_received_compact()}
		{:else}
			{received ? m.gift_mark_unreceived() : m.gift_mark_received()}
		{/if}
	</Button>
{/if}
