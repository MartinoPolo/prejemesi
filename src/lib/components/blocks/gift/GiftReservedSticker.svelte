<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import CheckIcon from '@lucide/svelte/icons/check';
	import { giftCardVariants } from './gift_card_variants.js';

	interface GiftReservedStickerProps {
		/** „rezervoval(a) Babička" — moderators only (issue #198); null hides the names line. */
		reserverLine?: string | null;
	}

	let { reserverLine = null }: GiftReservedStickerProps = $props();

	// The sticker slots are dimmed-invariant, so a plain call yields their crisp classes; this is
	// the single sticker definition shared by the card and list views (issue #224 REQ-7).
	const styles = giftCardVariants();
</script>

<span class={styles.reservedSticker()} data-testid="gift-reserved-sticker">
	<span class={styles.reservedStickerLabel()}>
		<CheckIcon class="size-3.5" />
		{m.gift_reserved_overlay()}
	</span>
	{#if reserverLine !== null}
		<small class={styles.reservedStickerNames()}>{reserverLine}</small>
	{/if}
</span>
