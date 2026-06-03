<script lang="ts">
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';
	import { formatPieceCount } from '$lib/modules/gifts/gift_display.js';

	interface GiftPieceCountProps {
		quantity: number | null;
		role: WishlistRole;
		reservedCount?: number;
		hideWhenOne?: boolean;
	}

	let { quantity, role, reservedCount, hideWhenOne = false }: GiftPieceCountProps = $props();

	const result = $derived(formatPieceCount(quantity, role, reservedCount));
	const shouldHide = $derived(result === null || (hideWhenOne && quantity === 1));
</script>

{#if !shouldHide && result}
	<span class="text-sm text-muted-foreground">{result.pieceText}</span>
	{#if result.reservedText}
		<span class="text-sm text-muted-foreground"> &middot; </span>
		<span class="text-sm text-reserved">{result.reservedText}</span>
	{/if}
{/if}
