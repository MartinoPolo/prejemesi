<script lang="ts">
	import { cn } from '$lib/utils.js';
	import * as m from '$lib/paraglide/messages.js';
	import { wishlistPreviewVariants } from './wishlist_preview_variants.js';

	interface Props {
		/** Emoji shown on the themed preview surface. */
		emoji?: string;
		/** Optional caption under the emoji. */
		label?: string;
		class?: string;
	}

	let { emoji = '🎁', label, class: className }: Props = $props();

	const styles = wishlistPreviewVariants();
</script>

<div
	class={cn(styles.root(), className)}
	role="img"
	aria-label={label ?? m.wishlist_preview_label()}
>
	<span class={styles.icon()} aria-hidden="true">{emoji}</span>
	{#if label}
		<span class={styles.label()}>{label}</span>
	{/if}
</div>
