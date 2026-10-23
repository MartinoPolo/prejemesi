<script lang="ts">
	import { cn } from '$lib/utils.js';
	import {
		WISHLIST_SLOT_SPECS,
		type ImageFrameProps,
		type WishlistEditorSlot,
	} from '$lib/modules/images/index.js';
	import WishlistSlotImage from './WishlistSlotImage.svelte';

	interface Props {
		slot: WishlistEditorSlot;
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
		/** Framing status chip (#533), e.g. the slot's mode or its manual crop. */
		status?: string | null;
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
		status = null,
		onclick,
		class: className,
	}: Props = $props();
</script>

<!--
One representative preview tile for a wishlist image slot. Renders the slot at its
TRUE production aspect ratio from the shared crop-target registry (#116 REQ-6/7)
via the shared WishlistSlotImage, so the owner sees the exact framing the real
surface will use. Clicking selects the slot for editing.
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
	<!-- The image is absolutely positioned: a %-height child inside an aspect-ratio
	     box is circular, so the intrinsic image height would stretch the tile. -->
	<div
		class={cn(
			'relative w-full overflow-hidden rounded-lg border transition-colors',
			active ? 'border-primary ring-1 ring-primary' : 'border-border',
		)}
		style:aspect-ratio={WISHLIST_SLOT_SPECS[slot].cssAspect}
		data-testid="wishlist-preview-{slot}"
	>
		<WishlistSlotImage class="absolute inset-0" {src} {frame} {themeEmoji} alt={label} />
	</div>
	<!-- Wraps instead of truncating: narrow mobile tiles drop the size below the full name. -->
	<span
		class="flex flex-wrap items-baseline justify-between gap-x-1 text-xs text-muted-foreground"
	>
		<span class="min-w-0 break-words">{label}</span>
		<small class="text-[10px] whitespace-nowrap tabular-nums opacity-70">
			{WISHLIST_SLOT_SPECS[slot].realSizeText}
		</small>
	</span>
	{#if status !== null}
		<span
			class="w-fit rounded-full border border-border px-1.5 text-[10px] text-muted-foreground"
			data-testid="wishlist-preview-status-{slot}"
		>
			{status}
		</span>
	{/if}
</button>
