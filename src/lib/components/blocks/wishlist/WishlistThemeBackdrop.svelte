<script lang="ts">
	import { IMAGE_VARIANTS, responsiveImageSource } from '$lib/modules/images/variants.js';
	import type { MotifPlacement, WishlistThemeArt } from '$lib/theme/wishlist_theme_art/index.js';
	import type { WishlistBackground, WishlistBackgroundMode } from '$lib/theme/wishlist_themes.js';

	interface WishlistThemeBackdropProps {
		/** The backdrop actually rendered (see `resolveWishlistThemeScope`); `none` renders nothing. */
		mode: WishlistBackgroundMode;
		/** Theme art; null while it loads, so only the CSS pattern paints meanwhile. */
		art: WishlistThemeArt | null;
		/** Custom background URL, required for the custom mode. */
		imageUrl: string | null;
		background: WishlistBackground;
	}

	type MotifSide = MotifPlacement['side'];

	/** The custom photo drifts this far over the whole scroll. */
	const PHOTO_DRIFT_PX = 50;

	let { mode, art, imageUrl, background }: WishlistThemeBackdropProps = $props();

	const placementsBySide = $derived.by(() => {
		const sides: Record<MotifSide, MotifPlacement[]> = { left: [], right: [], band: [] };
		for (const placement of art?.placements ?? []) {
			if (art?.motifs[placement.motif] !== undefined) {
				sides[placement.side].push(placement);
			}
		}
		return sides;
	});
	const photoSource = $derived(
		imageUrl === null
			? null
			: responsiveImageSource(imageUrl, 'background', IMAGE_VARIANTS.background.cssWidth),
	);
</script>

{#snippet motifLayer(side: MotifSide)}
	{#each placementsBySide[side] as placement, index (index)}
		<div
			class="wishlist-backdrop-motif"
			data-testid="wishlist-backdrop-motif"
			style:--motif-x={placement.x}
			style:--motif-y={side === 'band' ? `${placement.y}px` : `${placement.y}%`}
			style:--motif-size="{placement.size}px"
			style:--motif-rotate="{placement.rotate}deg"
			style:--motif-depth={placement.depth}
			style:--motif-opacity={placement.opacity}
		>
			<svg viewBox="0 0 100 100" aria-hidden="true">
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- static, trusted theme art -->
				{@html art?.motifs[placement.motif]}
			</svg>
		</div>
	{/each}
{/snippet}

{#if mode !== 'none'}
	<div
		class="wishlist-backdrop"
		aria-hidden="true"
		data-testid="wishlist-theme-backdrop"
		data-mode={mode}
		data-placement={mode === 'custom' ? background.placement : undefined}
		data-motion={background.motion}
		style:--photo-focal-x="{background.focal.x}%"
		style:--photo-focal-y="{background.focal.y}%"
		style:--photo-dim="{background.dim}%"
		style:--photo-drift={PHOTO_DRIFT_PX}
	>
		{#if mode === 'custom' && imageUrl !== null}
			<div class="wishlist-backdrop-photo">
				<img
					src={photoSource?.src ?? imageUrl}
					srcset={photoSource?.srcset}
					sizes={photoSource === null ? undefined : '100vw'}
					alt=""
					decoding="async"
					data-testid="wishlist-backdrop-photo"
				/>
				<div class="wishlist-backdrop-dim"></div>
			</div>
			<div class="wishlist-backdrop-wash"></div>
		{:else}
			<div class="wishlist-backdrop-pattern"></div>
			<div class="wishlist-backdrop-wash"></div>
			<div class="wishlist-backdrop-gutter" data-side="left">
				{@render motifLayer('left')}
			</div>
			<div class="wishlist-backdrop-gutter" data-side="right">
				{@render motifLayer('right')}
			</div>
			<div class="wishlist-backdrop-band">{@render motifLayer('band')}</div>
		{/if}
	</div>
{/if}

<style>
	/* Positioned against the wishlist content column (`.wishlist-detail-content` in the app
	   layout), then widened to the whole scroller so it also paints the side gutters. */
	.wishlist-backdrop {
		--gutter-width: calc((100% - min(100%, var(--content-max-width))) / 2);

		position: absolute;
		z-index: -1;
		top: 0;
		bottom: 0;
		left: 50%;
		width: 100cqi;
		overflow: clip;
		pointer-events: none;
		background: var(--background);
		translate: -50% 0;
	}

	.wishlist-backdrop-pattern {
		position: absolute;
		inset: 0;
		background: var(--theme-backdrop, var(--background));
	}

	.wishlist-backdrop-wash {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 50%;
		width: min(100%, calc(var(--content-max-width) + 32px));
		background: linear-gradient(
			90deg,
			transparent,
			var(--theme-wash, transparent) 32px,
			var(--theme-wash, transparent) calc(100% - 32px),
			transparent
		);
		translate: -50% 0;
	}

	.wishlist-backdrop-gutter {
		position: absolute;
		top: 0;
		bottom: 0;
		display: none;
		width: var(--gutter-width);
		container-type: inline-size;
	}

	.wishlist-backdrop-gutter[data-side='left'] {
		left: 0;
	}

	.wishlist-backdrop-gutter[data-side='right'] {
		right: 0;
	}

	.wishlist-backdrop-band {
		position: absolute;
		top: 0;
		right: 0;
		left: 0;
		height: var(--wishlist-band-height);
	}

	.wishlist-backdrop-motif {
		--motif-width: calc(var(--motif-size) * var(--motif-scale, 1));

		position: absolute;
		top: var(--motif-y);
		left: calc((100% - var(--motif-width)) * var(--motif-x));
		width: var(--motif-width);
		aspect-ratio: 1;
		opacity: var(--motif-opacity);
		rotate: var(--motif-rotate);
	}

	.wishlist-backdrop-gutter .wishlist-backdrop-motif {
		--motif-width: min(var(--motif-size), 100cqi);
	}

	.wishlist-backdrop-motif svg {
		display: block;
		width: 100%;
		height: 100%;
		overflow: visible;
		filter: drop-shadow(3px 3px 0 color-mix(in oklab, var(--m-ink) 22%, transparent));
	}

	/* Sticky to the scroller, one viewport tall plus its drift so drifting never uncovers it. */
	.wishlist-backdrop-photo {
		position: sticky;
		top: 0;
		width: 100%;
		height: calc(100dvh + var(--photo-drift) * 1px);
		overflow: hidden;
	}

	.wishlist-backdrop-photo img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: var(--photo-focal-x) var(--photo-focal-y);
	}

	.wishlist-backdrop-dim {
		position: absolute;
		inset: 0;
		background: color-mix(in oklab, var(--background) var(--photo-dim), transparent);
	}

	.wishlist-backdrop[data-mode='custom'] .wishlist-backdrop-wash {
		--theme-wash: transparent;
	}

	.wishlist-backdrop[data-placement='gutters'] .wishlist-backdrop-wash {
		--theme-wash: color-mix(in oklab, var(--background) 88%, transparent);
	}

	.wishlist-backdrop[data-placement='gutters'] .wishlist-backdrop-dim {
		display: none;
	}

	/* Breakpoints and band heights come from wishlist_scope.css. */
	@container app-content (width >= 1360px) {
		.wishlist-backdrop-gutter {
			display: block;
		}

		.wishlist-backdrop-band {
			display: none;
		}
	}

	/* A chosen column count can narrow the gutters below the art's size. */
	@container (width < 72px) {
		.wishlist-backdrop-motif {
			display: none;
		}
	}

	/* Without gutters a gutter-placed photo shows as the strip; phones always use the strip. */
	@container app-content (width < 1360px) {
		.wishlist-backdrop[data-placement='gutters'] .wishlist-backdrop-photo {
			position: absolute;
			height: var(--wishlist-band-height);
		}

		.wishlist-backdrop[data-placement='gutters'] .wishlist-backdrop-wash {
			display: none;
		}
	}

	@container app-content (width < 640px) {
		.wishlist-backdrop-motif {
			--motif-scale: 0.62;
		}

		.wishlist-backdrop[data-mode='custom'] .wishlist-backdrop-photo {
			position: absolute;
			height: var(--wishlist-band-height);
		}

		.wishlist-backdrop[data-mode='custom'] .wishlist-backdrop-dim,
		.wishlist-backdrop[data-mode='custom'] .wishlist-backdrop-wash {
			display: none;
		}
	}

	@keyframes wishlist-backdrop-motif-drift {
		to {
			translate: 0 calc(var(--motif-depth) * -1px);
		}
	}

	@keyframes wishlist-backdrop-photo-drift {
		to {
			translate: 0 calc(var(--photo-drift) * -1px);
		}
	}

	@media (prefers-reduced-motion: no-preference) {
		@supports (animation-timeline: scroll()) {
			.wishlist-backdrop:not([data-motion='off']) .wishlist-backdrop-motif {
				animation: wishlist-backdrop-motif-drift linear both;
				animation-timeline: scroll(nearest block);
			}

			.wishlist-backdrop:not([data-motion='off']) .wishlist-backdrop-photo {
				animation: wishlist-backdrop-photo-drift linear both;
				animation-timeline: scroll(nearest block);
			}
		}
	}
</style>
