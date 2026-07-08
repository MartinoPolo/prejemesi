<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { WISHLIST_SLOT_ASPECT, type ImageFrameProps } from '$lib/modules/images/index.js';
	import type { WishlistImageSlot } from '$lib/modules/images/index.js';
	import WishlistSlotImage from './WishlistSlotImage.svelte';

	interface Props {
		slot: WishlistImageSlot;
		/** Human label for the slot (localized). */
		label: string;
		/** Resolved image URL – null renders the themed fallback. */
		src: string | null;
		/** Renderer props derived from this slot's crop metadata. */
		frame: ImageFrameProps;
		/** Theme-derived fallback emoji. */
		themeEmoji: string;
		/** Marks this tile as the slot currently being edited. */
		active?: boolean;
		onclick?: () => void;
		class?: string;
	}

	let {
		slot,
		label,
		src,
		frame,
		themeEmoji,
		active = false,
		onclick,
		class: className,
	}: Props = $props();
</script>

<!--
One representative preview tile for a wishlist image slot (REQ-2). Renders the slot at
its true production aspect ratio via the shared WishlistSlotImage so the owner sees the
exact framing each surface will use. Clicking selects the slot for editing.
-->
<button
	type="button"
	{onclick}
	aria-pressed={active}
	class={cn(
		'flex flex-col gap-1.5 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring',
		className,
	)}
>
	<div
		class={cn(
			'w-full overflow-hidden rounded-lg border transition-colors',
			active ? 'border-primary ring-1 ring-primary' : 'border-border',
		)}
		style:aspect-ratio={WISHLIST_SLOT_ASPECT[slot]}
	>
		<WishlistSlotImage {src} {frame} {themeEmoji} alt={label} />
	</div>
	<span class="flex items-baseline justify-between gap-1 text-xs text-foreground-subtle">
		<span class="truncate">{label}</span>
		<small class="text-[10px] tabular-nums opacity-70">{WISHLIST_SLOT_ASPECT[slot]}</small>
	</span>
</button>
