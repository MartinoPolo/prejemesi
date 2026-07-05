<script lang="ts">
	import { cn } from '$lib/utils.js';
	import ImageFrame from '$lib/components/derived/image-frame/ImageFrame.svelte';
	import { IMAGE_TOKEN_SCOPES } from '$lib/components/derived/image-frame/index.js';
	import type { ImageFrameProps } from '$lib/modules/images/index.js';
	import WishlistFallbackHero from './WishlistFallbackHero.svelte';

	interface Props {
		/** Resolved image URL for the active slot – null renders the themed fallback. */
		src: string | null;
		/** Renderer props derived from the slot's saved (or live) crop metadata. */
		frame: ImageFrameProps;
		/** Theme-derived emoji for the no-image fallback (REQ-3). */
		themeEmoji: string;
		/** Accessible description. */
		alt: string;
		class?: string;
	}

	let { src, frame, themeEmoji, alt, class: className }: Props = $props();
</script>

<!--
Single integration point for every wishlist image surface (card, list thumbnail,
header banner, social preview, and the editor previews). When an image is assigned it
renders through the shared #34 ImageFrame with the slot's saved crop metadata so
presentation is identical everywhere; otherwise it shows the theme-aware fallback hero.
-->
{#if src !== null}
	<ImageFrame
		class={cn('size-full', className)}
		{src}
		{alt}
		fitMode={frame.fitMode}
		focal={frame.focal}
		zoom={frame.zoom}
		fillColor={frame.fillColor}
		fallbackEmoji={themeEmoji}
		tokenScope={IMAGE_TOKEN_SCOPES.wishlist}
	/>
{:else}
	<WishlistFallbackHero class={className} emoji={themeEmoji} label={alt} />
{/if}
