<script lang="ts">
	import GiftImage from './GiftImage.svelte';
	import type { ImageMetadata, ImageVariant } from '$lib/modules/images/index.js';
	import { cn } from '$lib/utils.js';

	interface Props {
		imageUrl: string | null;
		imageMeta: ImageMetadata | null;
		alt: string;
		variant?: ImageVariant | null;
		class?: string;
	}

	let { imageUrl, imageMeta, alt, variant = 'listThumb', class: className }: Props = $props();
</script>

<div
	class={cn('absolute inset-y-0 left-1/2 aspect-square h-full -translate-x-1/2', className)}
	data-testid="gift-list-square-composition"
>
	<GiftImage
		class="size-full rounded-none max-sm:[&_img]:p-0"
		{imageUrl}
		{imageMeta}
		target="thumb"
		{alt}
		{variant}
	/>
</div>
