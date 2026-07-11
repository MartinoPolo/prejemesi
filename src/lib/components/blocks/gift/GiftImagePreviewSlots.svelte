<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils.js';
	import ImageFrame from '$lib/components/derived/image-frame/ImageFrame.svelte';
	import {
		IMAGE_TOKEN_SCOPES,
		type ImageTokenScope,
	} from '$lib/components/derived/image-frame/index.js';
	import type { ImageFrameProps } from '$lib/modules/images/index.js';

	interface Props {
		/** Source image – null renders the themed fallback in every tile. */
		src: string | null;
		/** Accessible description shared by every tile. */
		alt: string;
		/** Renderer presentation props (fit/focal/zoom/fill) shared by every tile. */
		frame: ImageFrameProps;
		tokenScope?: ImageTokenScope;
		/** Force the loading skeleton across every tile. */
		loading?: boolean;
		class?: string;
	}

	let {
		src,
		alt,
		frame,
		tokenScope = IMAGE_TOKEN_SCOPES.wishlist,
		loading = false,
		class: className,
	}: Props = $props();

	// Each tile mirrors the SHAPE its real consumer renders at, so the preview never
	// lies about how the crop will actually look (REQ-2). Proof of each real box:
	//   card        → GiftCard imageArea `h-32 w-full` (fixed 128px height, fluid width) → gift_card_variants.ts
	//   list        → GiftListItem `size-16` (1:1) → GiftListItem.svelte
	//   detail      → GiftDetailForm ImageFrame fills the 45% portrait column (~3:4) → gift_detail_modal_variants.ts
	//   reservation → ReserveModal `size-12` (1:1) → reserve_modal_variants.ts
	// The card is fluid-width at a fixed height, so it uses `h-32 w-full` rather than a
	// misleading fixed ratio; `ratioText` annotates that (height, not an aspect).
	const SLOTS = [
		{ key: 'card', label: m.gift_image_slot_card, ratioText: '128 px', sizing: 'h-32 w-full' },
		{ key: 'list', label: m.gift_image_slot_list, ratioText: '1:1', sizing: 'aspect-square' },
		{
			key: 'detail',
			label: m.gift_image_slot_detail,
			ratioText: '3:4',
			sizing: 'aspect-[3/4]',
		},
		{
			key: 'reservation',
			label: m.gift_image_slot_reservation,
			ratioText: '1:1',
			sizing: 'aspect-square',
		},
	] as const;
</script>

<div class={cn('flex flex-col gap-2', className)}>
	<span class="text-xs font-medium tracking-wide text-foreground-subtle uppercase">
		{m.gift_image_preview_strip_label()}
	</span>
	<ul class="grid grid-cols-2 gap-3 sm:grid-cols-4">
		{#each SLOTS as slot (slot.key)}
			<li class="flex flex-col gap-1.5">
				<ImageFrame
					class={cn('w-full', slot.sizing)}
					{src}
					{alt}
					fitMode={frame.fitMode}
					focal={frame.focal}
					zoom={frame.zoom}
					fillColor={frame.fillColor}
					{tokenScope}
					{loading}
				/>
				<span
					class="flex items-baseline justify-between gap-1 text-xs text-foreground-subtle"
				>
					<span class="truncate">{slot.label()}</span>
					<small class="text-[10px] tabular-nums opacity-70">{slot.ratioText}</small>
				</span>
			</li>
		{/each}
	</ul>
</div>
