<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils.js';
	import { applyWishlistTheme, removeWishlistTheme } from '$lib/modules/themes/apply_theme.js';
	import type { WishlistTheme } from '$lib/modules/themes/types.js';
	import { imageMetaToFrameProps, type ImageFrameProps } from '$lib/modules/images/index.js';
	import WishlistSlotImage from './WishlistSlotImage.svelte';

	interface Props {
		/** Theme whose palette is applied to this preview (reacts live to selection). */
		theme: WishlistTheme;
		/** Theme-derived emoji for the banner fallback. */
		emoji: string;
		/** Theme display label. */
		themeLabel: string;
		/** Sample title shown on the preview card. */
		title?: string;
		/** Optional assigned image URL – null shows the themed fallback. */
		src?: string | null;
		/** Renderer props for the card slot (defaults to renderer defaults). */
		frame?: ImageFrameProps;
		class?: string;
	}

	let {
		theme,
		emoji,
		themeLabel,
		title = m.theme_preview_sample_title(),
		src = null,
		frame = imageMetaToFrameProps(null),
		class: className,
	}: Props = $props();

	let wrapperEl = $state<HTMLElement | null>(null);

	// Apply the selected theme's palette to this preview only, so the --wishlist-* tokens
	// inside render the chosen theme without affecting the rest of the page.
	$effect(() => {
		if (wrapperEl === null) {
			return;
		}
		applyWishlistTheme(wrapperEl, theme);
		return () => {
			if (wrapperEl !== null) {
				removeWishlistTheme(wrapperEl);
			}
		};
	});
</script>

<!--
Realistic wishlist-card preview (REQ-4): a true card surface reacting to the selected
theme and to the assigned image / themed fallback – replaces the former thin accent
line. Uses only --wishlist-* tokens so it reflects the theme in light and dark mode.
-->
<div
	bind:this={wrapperEl}
	class={cn(
		'overflow-hidden rounded-xl border border-wishlist-border bg-wishlist-surface shadow-sm',
		className,
	)}
>
	<div class="aspect-[3/2] w-full">
		<WishlistSlotImage {src} {frame} themeEmoji={emoji} alt={title} />
	</div>
	<div class="flex flex-col gap-2 p-3">
		<span class="truncate text-sm font-semibold text-wishlist-primary">{title}</span>
		<span
			class="inline-flex w-fit items-center gap-1 rounded-full bg-wishlist-muted px-2 py-0.5 text-xs text-wishlist-muted-fg"
		>
			{emoji}
			{themeLabel}
		</span>
		<div class="mt-1 flex flex-col gap-1.5" aria-hidden="true">
			<div class="h-2 w-3/4 rounded-full bg-wishlist-muted"></div>
			<div class="h-2 w-1/2 rounded-full bg-wishlist-muted"></div>
		</div>
	</div>
</div>
