<script lang="ts">
	import GiftImage from './GiftImage.svelte';
	import type { ImageMetadata, ImageVariant } from '$lib/modules/images/index.js';
	import type { ImageLoadPriority } from '$lib/components/derived/image-frame/index.js';
	import { cn } from '$lib/utils.js';
	import { GIFT_CARD_LAYOUT_INERT_ATTRIBUTE } from './gift_card_layout_inert.js';

	interface Props {
		imageUrl: string | null;
		imageMeta: ImageMetadata | null;
		alt: string;
		variant?: ImageVariant | null;
		loadPriority?: ImageLoadPriority;
		class?: string;
	}

	let {
		imageUrl,
		imageMeta,
		alt,
		variant = 'listThumb',
		loadPriority,
		class: className,
	}: Props = $props();
</script>

<div
	class={cn('absolute inset-y-0 left-1/2 aspect-square h-full -translate-x-1/2', className)}
	data-testid="gift-list-square-composition"
	{...{ [GIFT_CARD_LAYOUT_INERT_ATTRIBUTE]: '' }}
>
	<GiftImage
		class="size-full rounded-none max-sm:[&_img]:p-0"
		{imageUrl}
		{imageMeta}
		target="thumb"
		{alt}
		{variant}
		{loadPriority}
	/>
</div>
