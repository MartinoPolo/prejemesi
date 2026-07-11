<script lang="ts">
	import { cn } from '$lib/utils.js';

	interface Props {
		/** Theme-derived emoji shown large and centered (REQ-3). */
		emoji: string;
		/** Accessible label (defaults to the emoji). */
		label?: string;
		class?: string;
	}

	let { emoji, label, class: className }: Props = $props();
</script>

<!--
Theme-aware no-image fallback (REQ-3): a themed background with a large, scale-aware
emoji. Container-query units size the emoji relative to the slot so the same component
reads well from a tiny list thumbnail up to a full-width banner. Palette tokens
re-derive per [data-palette] subtree, so the tint follows the wishlist's palette.
-->
<div
	class={cn(
		'flex size-full items-center justify-center bg-tint [container-type:size]',
		className,
	)}
	role="img"
	aria-label={label ?? emoji}
>
	<span class="leading-none text-primary [font-size:40cqmin]" aria-hidden="true">{emoji}</span>
</div>
