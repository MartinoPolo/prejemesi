<script lang="ts">
	import ImageFrame from '$lib/components/derived/image-frame/ImageFrame.svelte';
	import {
		IMAGE_TOKEN_SCOPES,
		type ImageTokenScope,
	} from '$lib/components/derived/image-frame/index.js';
	import {
		imageMetaToFrameProps,
		type ImageMetadata,
		type ImageVariant,
	} from '$lib/modules/images/index.js';

	interface Props {
		/** Image source URL – null/empty renders the themed fallback. */
		imageUrl: string | null;
		/** Persisted presentation metadata (fit mode + crop/focal + bg fill). */
		imageMeta: ImageMetadata | null;
		/** Accessible description (the gift name). */
		alt: string;
		/**
		 * Size-appropriate delivery variant (issue #107). Card and list surfaces
		 * pass their bounded variant; the detail view omits it to load the
		 * original (which also preserves GIF animation).
		 */
		variant?: ImageVariant | null;
		/** Eager-load above-the-fold surfaces; everything else lazy-loads. */
		eagerLoading?: boolean;
		/** Scopes the tier-2 background fill; gift images live inside a wishlist. */
		tokenScope?: ImageTokenScope;
		class?: string;
	}

	let {
		imageUrl,
		imageMeta,
		alt,
		variant = null,
		eagerLoading = false,
		tokenScope = IMAGE_TOKEN_SCOPES.wishlist,
		class: className,
	}: Props = $props();

	// Single integration point: every gift image consumer renders through the shared
	// #34 renderer with the saved metadata, so presentation is identical everywhere.
	const frame = $derived(imageMetaToFrameProps(imageMeta));
</script>

<ImageFrame
	class={className}
	src={imageUrl}
	{alt}
	{variant}
	{eagerLoading}
	fitMode={frame.fitMode}
	focal={frame.focal}
	zoom={frame.zoom}
	fillColor={frame.fillColor}
	{tokenScope}
/>
