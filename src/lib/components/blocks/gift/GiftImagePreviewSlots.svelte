<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils.js';
	import ImageFrame from '$lib/components/derived/image-frame/ImageFrame.svelte';
	import {
		IMAGE_TOKEN_SCOPES,
		type ImageFitMode,
		type ImageTokenScope,
	} from '$lib/components/derived/image-frame/index.js';

	interface Focal {
		x: number;
		y: number;
	}

	interface Props {
		/** Source image — null renders the themed fallback in every tile. */
		src: string | null;
		/** Accessible description shared by every tile. */
		alt: string;
		fitMode: ImageFitMode;
		focal: Focal;
		zoom: number;
		/** Tier-1 background fill behind any letterboxing. */
		fillColor?: string | null;
		tokenScope?: ImageTokenScope;
		/** Force the loading skeleton across every tile. */
		loading?: boolean;
		class?: string;
	}

	let {
		src,
		alt,
		fitMode,
		focal,
		zoom,
		fillColor = null,
		tokenScope = IMAGE_TOKEN_SCOPES.wishlist,
		loading = false,
		class: className,
	}: Props = $props();

	// The four real gift-image consumers and their exact aspect ratios (REQ-2).
	// Ratios are fixed and mirror production; only the label/aspect differs per tile.
	const SLOTS = [
		{ key: 'card', label: m.gift_image_slot_card, ratioText: '3:2', aspect: 'aspect-[3/2]' },
		{ key: 'list', label: m.gift_image_slot_list, ratioText: '1:1', aspect: 'aspect-square' },
		{
			key: 'detail',
			label: m.gift_image_slot_detail,
			ratioText: '3:4',
			aspect: 'aspect-[3/4]',
		},
		{
			key: 'reservation',
			label: m.gift_image_slot_reservation,
			ratioText: '1:1',
			aspect: 'aspect-square',
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
					class={cn('w-full', slot.aspect)}
					{src}
					{alt}
					{fitMode}
					{focal}
					{zoom}
					{fillColor}
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
