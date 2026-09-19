<script lang="ts">
	import GiftImage from './GiftImage.svelte';
	import type { ImageMetadata, ImageVariant } from '$lib/modules/images/index.js';

	interface Props {
		imageUrl: string | null;
		imageMeta: ImageMetadata | null;
		alt: string;
		variant?: ImageVariant | null;
	}

	let { imageUrl, imageMeta, alt, variant = 'listThumb' }: Props = $props();
</script>

<div
	class="absolute inset-y-0 left-1/2 aspect-square h-full -translate-x-1/2"
	data-testid="gift-list-square-composition"
>
	<GiftImage
		class="size-full rounded-l-[calc(var(--radius-panel)-var(--nested-border-inline))] rounded-r-none max-sm:[&_img]:p-0"
		{imageUrl}
		{imageMeta}
		target="thumb"
		{alt}
		{variant}
	/>
</div>
