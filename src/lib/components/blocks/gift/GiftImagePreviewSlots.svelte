<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils.js';
	import ImageFrame from '$lib/components/derived/image-frame/ImageFrame.svelte';
	import {
		hasExplicitFrameFill,
		IMAGE_TOKEN_SCOPES,
		type ImageTokenScope,
	} from '$lib/components/derived/image-frame/index.js';
	import {
		giftTargetFrameProps,
		GIFT_CROP_TARGET_SPECS,
		type GiftEditorCropTarget,
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
		activeTarget?: GiftEditorCropTarget | null;
		/** Makes tiles buttons: clicking one selects its crop target (#116 follow-up). */
		onTileSelect?: (target: GiftEditorCropTarget) => void;
		tokenScope?: ImageTokenScope;
		/** Force the loading skeleton across every tile. */
		loading?: boolean;
		/** Prevents crop-target selection while a gift mutation is pending. */
		disabled?: boolean;
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
		disabled = false,
		class: className,
	}: Props = $props();

	const thumbnailHelpId = $props.id();
	const TILES = [
		{
			key: 'square',
			target: 'square',
			label: m.gift_image_target_card,
			// Height-only (issue #183): the `square` target is 4:3, not 1:1, so the
			// width must be derived from `aspect-ratio` below rather than fixed –
			// `size-14` (equal width+height) would leave both dimensions definite
			// and the CSS `aspect-ratio` box-sizing rule (which only kicks in when
			// exactly one axis is definite) would never apply, rendering a square.
			sizing: 'h-14',
			cssAspect: GIFT_CROP_TARGET_SPECS.square.cssAspect,
		},
		{
			key: 'thumb',
			target: 'thumb',
			label: m.gift_image_target_thumb,
			sizing: 'size-14',
			cssAspect: GIFT_CROP_TARGET_SPECS.thumb.cssAspect,
		},
	] as const satisfies readonly {
		key: string;
		target: GiftEditorCropTarget;
		label: () => string;
		sizing: string;
		cssAspect: string;
	}[];
</script>

<ul class={cn('pointer-events-none flex items-end justify-center gap-3', className)}>
	{#each TILES as tile (tile.key)}
		{@const frame = giftTargetFrameProps(imageMeta, tile.target)}
		{@const showCardPattern =
			tile.target === 'square' && !hasExplicitFrameFill(frame.fillColor)}
		<li class="min-w-0">
			{#snippet tileFace()}
				<!-- The frame is absolutely positioned: a %-height child inside an
				     aspect-ratio box is circular, so the image's intrinsic height
				     would otherwise stretch the tile past its true aspect. -->
				<div
					class={cn(
						'relative overflow-hidden rounded-md border-2 border-ink bg-card shadow-sticker',
						tile.sizing,
						activeTarget === tile.target && 'ring-2 ring-primary',
					)}
					style:aspect-ratio={tile.cssAspect}
					data-testid="gift-preview-{tile.key}"
				>
					{#if showCardPattern}
						<div
							class="pointer-events-none absolute inset-0 bg-[radial-gradient(var(--pattern-dot)_1.4px,transparent_1.5px)] bg-size-[18px_18px] opacity-60"
							data-testid="gift-preview-card-pattern"
							aria-hidden="true"
						></div>
					{/if}
					<ImageFrame
						class={cn('absolute inset-0', showCardPattern && 'bg-transparent')}
						{src}
						{alt}
						fitMode={frame.fitMode}
						focal={frame.focal}
						zoom={frame.zoom}
						fillColor={frame.fillColor}
						{tokenScope}
						{loading}
					/>
				</div>
				<span
					class="rounded-full bg-surface/90 px-2 py-0.5 text-[10px] font-semibold text-foreground"
				>
					{tile.label()}
				</span>
			{/snippet}
			<!-- A tile is a button when selectable (clicking jumps to Manual for its target). -->
			{#if onTileSelect !== undefined}
				<button
					type="button"
					onclick={() => onTileSelect?.(tile.target)}
					{disabled}
					aria-pressed={activeTarget === tile.target}
					aria-describedby={tile.target === 'thumb' ? thumbnailHelpId : undefined}
					data-testid="gift-preview-tile-{tile.key}"
					class="pointer-events-auto flex cursor-pointer flex-col items-center gap-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					{@render tileFace()}
				</button>
			{:else}
				<div
					class="pointer-events-auto flex flex-col items-center gap-1"
					data-testid="gift-preview-tile-{tile.key}"
				>
					{@render tileFace()}
				</div>
			{/if}
		</li>
	{/each}
</ul>
<p id={thumbnailHelpId} class="mt-2 text-center text-xs text-muted-foreground">
	{m.gift_image_thumb_portrait_hint()}
</p>
