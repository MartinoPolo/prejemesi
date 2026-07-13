<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils.js';
	import ImageFrame from '$lib/components/derived/image-frame/ImageFrame.svelte';
	import {
		IMAGE_TOKEN_SCOPES,
		type ImageTokenScope,
	} from '$lib/components/derived/image-frame/index.js';
	import {
		giftTargetFrameProps,
		GIFT_CROP_TARGET_SPECS,
		type GiftCropTarget,
		type ImageMetadata,
	} from '$lib/modules/images/index.js';

	interface Props {
		/** Source image – null renders the themed fallback in every tile. */
		src: string | null;
		/** Accessible description shared by every tile. */
		alt: string;
		/** Live editor metadata; each tile derives its own per-target framing. */
		imageMeta: ImageMetadata | null;
		/** Target highlighted as being edited (Manual mode) – null highlights none. */
		activeTarget?: GiftCropTarget | null;
		/** Makes tiles buttons: clicking one selects its crop target (#116 follow-up). */
		onTileSelect?: (target: GiftCropTarget) => void;
		tokenScope?: ImageTokenScope;
		/** Force the loading skeleton across every tile. */
		loading?: boolean;
		class?: string;
	}

	let {
		src,
		alt,
		imageMeta,
		activeTarget = null,
		onTileSelect,
		tokenScope = IMAGE_TOKEN_SCOPES.wishlist,
		loading = false,
		class: className,
	}: Props = $props();

	// Each tile renders the TRUE shape and (where practical) the true size of its
	// real consumer surface (#116 REQ-7), and its own per-target framing, so the
	// strip never lies about how a crop will actually look. Aspect data comes from
	// the shared crop-target registry (REQ-6); real boxes:
	//   card        → GiftCard imageArea `h-32 w-full` (fluid width, ~356px @1280)
	//   list        → GiftListItem `size-16` (real size)
	//   detail      → GiftDetailForm image column (~403×806 @1280, shown at ~1/3)
	//   reservation → ReserveModal `size-12` (real size)
	const TILES = [
		{
			key: 'card',
			target: 'card',
			label: m.gift_image_slot_card,
			// Explicit width: inside the flex-wrap strip a percentage width is
			// indefinite and aspect-ratio could not resolve the tile's height.
			sizing: 'w-52',
			cssAspect: GIFT_CROP_TARGET_SPECS.card.cssAspect,
		},
		{
			key: 'list',
			target: 'square',
			label: m.gift_image_slot_list,
			sizing: 'size-16',
			cssAspect: GIFT_CROP_TARGET_SPECS.square.cssAspect,
		},
		{
			key: 'detail',
			target: 'detail',
			label: m.gift_image_slot_detail,
			sizing: 'h-56',
			cssAspect: GIFT_CROP_TARGET_SPECS.detail.cssAspect,
		},
		{
			key: 'reservation',
			target: 'square',
			label: m.gift_image_slot_reservation,
			sizing: 'size-12',
			cssAspect: GIFT_CROP_TARGET_SPECS.square.cssAspect,
		},
	] as const satisfies readonly {
		key: string;
		target: GiftCropTarget;
		label: () => string;
		sizing: string;
		cssAspect: string;
	}[];
</script>

<div class={cn('flex flex-col gap-2', className)}>
	<span class="text-xs font-medium tracking-wide text-foreground-subtle uppercase">
		{m.gift_image_preview_strip_label()}
	</span>
	<ul class="flex flex-wrap items-end gap-x-4 gap-y-3">
		{#each TILES as tile (tile.key)}
			{@const frame = giftTargetFrameProps(imageMeta, tile.target)}
			<li class="flex min-w-0 flex-col gap-1.5">
				{#snippet tileFrame()}
					<ImageFrame
						class="absolute inset-0"
						{src}
						{alt}
						fitMode={frame.fitMode}
						focal={frame.focal}
						zoom={frame.zoom}
						fillColor={frame.fillColor}
						{tokenScope}
						{loading}
					/>
				{/snippet}
				<!-- The frame is absolutely positioned: a %-height child inside an
				     aspect-ratio box is circular, so the image's intrinsic height
				     would otherwise stretch the tile past its true aspect. A tile is
				     a button when selectable (clicking jumps to Manual for its target). -->
				{#if onTileSelect !== undefined}
					<button
						type="button"
						onclick={() => onTileSelect?.(tile.target)}
						aria-pressed={activeTarget === tile.target}
						aria-label={tile.label()}
						class={cn(
							'relative block cursor-pointer overflow-hidden rounded-md outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring',
							tile.sizing,
							activeTarget === tile.target && 'ring-2 ring-primary',
						)}
						style:aspect-ratio={tile.cssAspect}
						data-testid="gift-preview-{tile.key}"
					>
						{@render tileFrame()}
					</button>
				{:else}
					<div
						class={cn('relative overflow-hidden rounded-md', tile.sizing)}
						style:aspect-ratio={tile.cssAspect}
						data-testid="gift-preview-{tile.key}"
					>
						{@render tileFrame()}
					</div>
				{/if}
				<span class="text-xs text-foreground-subtle">{tile.label()}</span>
			</li>
		{/each}
	</ul>
</div>
