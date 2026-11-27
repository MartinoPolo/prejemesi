<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';
	import { formatPieceCount } from '$lib/modules/gifts/gift_display.js';
	import { STANDARD_EASING } from '$lib/motion/motion_tokens.js';
	import * as m from '$lib/paraglide/messages.js';

	interface GiftPieceCountProps {
		quantity: number | null;
		role: WishlistRole;
		reservedCount?: number;
		hideWhenOne?: boolean;
		reservationAcknowledgementKey?: string | boolean | null;
		/** A shared gift's quantity is one total for all its recipients (issue #737). */
		shared?: boolean;
	}

	// Rendered as an expression because Svelte trims the leading space of literal block text.
	const RESERVED_TEXT_SEPARATOR = ' · ';

	let {
		quantity,
		role,
		reservedCount,
		hideWhenOne = false,
		reservationAcknowledgementKey = null,
		shared = false,
	}: GiftPieceCountProps = $props();

	const result = $derived(formatPieceCount(quantity, role, reservedCount));
	const shouldHide = $derived(result === null || (hideWhenOne && quantity === 1));
	const sharedTotal = $derived(shared && quantity !== null && quantity > 1 ? quantity : null);
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

		activeAnimation = element.animate([{ opacity: 0 }, { opacity: 1 }], {
			duration: 140,
			easing: STANDARD_EASING,
		});
	});

	onDestroy(() => activeAnimation?.cancel());
</script>

{#if !shouldHide && result}
	<span
		bind:this={countElement}
		data-testid="gift-piece-count"
		class="text-sm text-muted-foreground"
		title={sharedTotal === null
			? undefined
			: m.gift_shared_card_quantity_title({ count: sharedTotal })}
		>{sharedTotal === null
			? result.pieceText
			: m.gift_shared_card_quantity({
					count: sharedTotal,
				})}{#if result.reservedText}{RESERVED_TEXT_SEPARATOR}<span class="text-reserved"
				>{result.reservedText}</span
			>{/if}</span
	>
{/if}
