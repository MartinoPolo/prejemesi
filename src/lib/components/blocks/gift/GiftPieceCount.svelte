<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';
	import { formatPieceCount } from '$lib/modules/gifts/gift_display.js';

	interface GiftPieceCountProps {
		quantity: number | null;
		role: WishlistRole;
		reservedCount?: number;
		hideWhenOne?: boolean;
		reservationAcknowledgementKey?: string | boolean | null;
	}

	let {
		quantity,
		role,
		reservedCount,
		hideWhenOne = false,
		reservationAcknowledgementKey = null,
	}: GiftPieceCountProps = $props();

	const result = $derived(formatPieceCount(quantity, role, reservedCount));
	const shouldHide = $derived(result === null || (hideWhenOne && quantity === 1));
	let acknowledgementMounted = false;
	let previousAcknowledgementPresent = false;
	let shouldAnimateAcknowledgement = $state(false);
	let animationRun = $state(0);
	let countElement = $state<HTMLSpanElement | null>(null);
	let activeAnimation: Animation | null = null;

	$effect.pre(() => {
		const currentAcknowledgementPresent =
			reservationAcknowledgementKey !== null &&
			reservationAcknowledgementKey !== undefined &&
			reservationAcknowledgementKey !== false;
		if (!acknowledgementMounted) {
			acknowledgementMounted = true;
			previousAcknowledgementPresent = currentAcknowledgementPresent;
			return;
		}
		shouldAnimateAcknowledgement =
			!previousAcknowledgementPresent && currentAcknowledgementPresent;
		if (shouldAnimateAcknowledgement) {
			animationRun += 1;
		}
		previousAcknowledgementPresent = currentAcknowledgementPresent;
	});

	$effect(() => {
		const run = animationRun;
		const element = countElement;

		activeAnimation?.cancel();
		activeAnimation = null;
		if (run === 0 || !shouldAnimateAcknowledgement || element === null) {
			return;
		}
		if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
			return;
		}

		activeAnimation = element.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 140 });
	});

	onDestroy(() => activeAnimation?.cancel());
</script>

{#if !shouldHide && result}
	<span
		bind:this={countElement}
		data-testid="gift-piece-count"
		class="text-sm text-muted-foreground"
		>{result.pieceText}{#if result.reservedText}
			&middot; <span class="text-reserved">{result.reservedText}</span>{/if}</span
	>
{/if}
