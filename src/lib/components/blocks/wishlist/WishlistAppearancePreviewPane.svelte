<script lang="ts">
	import WishlistHeroFrame from '$lib/components/blocks/gift/WishlistHeroFrame.svelte';
	import { wishlistHeroFrameVariants } from '$lib/components/blocks/gift/wishlist_hero_frame_variants.js';
	import type { Palette } from '$lib/theme/palettes.js';
	import {
		findWishlistLibraryImage,
		wishlistLibraryImageThumbnailUrl,
	} from '$lib/theme/wishlist_background_library.js';
	import {
		wishlistStyleTokenAttributes,
		type WishlistThemeScope,
	} from './wishlist_theme_scope.js';

	interface WishlistAppearancePreviewPaneProps {
		/** The viewer mode this pane forces on its subtree, whatever the manager's own mode. */
		mode: 'light' | 'dark';
		palette: Palette;
		scope: WishlistThemeScope;
		title: string;
		/** Motif art for the backdrop strip; empty while it loads or without a motif backdrop. */
		motifs: readonly string[];
	}

	let { mode, palette, scope, title, motifs }: WishlistAppearancePreviewPaneProps = $props();

	let paneWidth = $state(0);
	let canvasWidth = $state(0);
	let canvasHeight = $state(0);
	// The page is laid out at a real width and scaled into the pane, so frames and corners keep
	// their true proportions.
	const scale = $derived(canvasWidth === 0 ? 0 : paneWidth / canvasWidth);
	const heroFrameStyles = $derived(wishlistHeroFrameVariants({ frame: scope.style.heroFrame }));
	const photoUrl = $derived.by(() => {
		if (scope.backgroundMode === 'custom') {
			return scope.customImageUrl;
		}
		const libraryImage =
			scope.backgroundMode === 'library'
				? findWishlistLibraryImage(scope.background.libraryImageId)
				: null;
		return libraryImage === null ? null : wishlistLibraryImageThumbnailUrl(libraryImage);
	});
</script>

{#snippet photoTile(className: string)}
	<span
		class={[
			'block shrink-0 overflow-hidden border-(length:--border-w) border-ink bg-[color:var(--wishlist-image-mat,var(--secondary))]',
			scope.style.mat === 'dotted' && 'bg-dots',
			scope.style.heroFrame === 'tag'
				? 'rounded-full'
				: 'rounded-[calc(var(--radius-panel)/2)]',
			className,
		]}
	></span>
{/snippet}

{#snippet giftCard()}
	<span
		class="flex flex-col overflow-hidden rounded-(--radius-panel) border-(length:--border-w) border-ink bg-card shadow-(--elevation-ordinary)"
	>
		<span
			class={[
				'block aspect-[4/3] border-b-(length:--border-w) border-ink bg-[color:var(--wishlist-image-mat,var(--secondary))]',
				scope.style.mat === 'dotted' && 'bg-dots',
			]}
		></span>
		<span class="flex flex-col gap-2 p-3">
			<span class="h-3 w-4/5 rounded-full bg-foreground/70"></span>
			<span class="h-2 w-1/2 rounded-full bg-muted-foreground/40"></span>
			<span
				class="mt-1 h-7 w-20 self-end rounded-(--radius-btn) border-(length:--border-w) border-ink bg-primary shadow-(--elevation-compact)"
			></span>
		</span>
	</span>
{/snippet}

<div
	class={['min-w-0', mode === 'dark' && 'dark']}
	data-light-scope={mode === 'light' ? '' : undefined}
	data-testid="wishlist-appearance-preview-pane"
	data-mode={mode}
>
	<div
		class="relative overflow-hidden rounded-[10px] border-2 border-ink bg-background"
		data-palette={palette}
		data-wishlist-theme={scope.backdropThemeId ?? undefined}
		{...wishlistStyleTokenAttributes(scope.style)}
		bind:clientWidth={paneWidth}
		style:height="{canvasHeight * scale}px"
		aria-hidden="true"
	>
		<div
			class="preview-canvas absolute top-0 left-0 origin-top-left"
			data-background={scope.backgroundMode}
			data-placement={scope.background.placement}
			style:transform="scale({scale})"
			style:--photo-dim="{scope.background.dim}%"
			style:--photo-focal="{scope.background.focal.x}% {scope.background.focal.y}%"
			bind:offsetWidth={canvasWidth}
			bind:offsetHeight={canvasHeight}
		>
			{#if scope.backgroundMode === 'theme'}
				<span class="absolute inset-0 [background:var(--theme-backdrop)]"></span>
				<span class="absolute inset-0 [background:var(--theme-wash)]"></span>
				{#each motifs.slice(0, 2) as motif, index (index)}
					<svg
						viewBox="0 0 100 100"
						class="preview-motif absolute overflow-visible"
						data-side={index === 0 ? 'start' : 'end'}
					>
						<!-- eslint-disable-next-line svelte/no-at-html-tags -- static, trusted theme art -->
						{@html motif}
					</svg>
				{/each}
			{:else if photoUrl !== null}
				<span class="preview-photo absolute inset-x-0 top-0 overflow-hidden">
					<img src={photoUrl} alt="" class="size-full object-cover" decoding="async" />
					<span class="preview-photo-dim absolute inset-0"></span>
				</span>
			{/if}

			<div class="preview-content relative flex flex-col gap-4">
				<WishlistHeroFrame frame={scope.style.heroFrame} layout="desktop">
					<div class={heroFrameStyles.face()}>
						{@render photoTile('size-24')}
						<div class="flex min-w-0 flex-col gap-2">
							<span class="h-2.5 w-24 rounded-full bg-muted-foreground/40"></span>
							<p
								class="line-clamp-2 font-heading text-[28px] leading-tight font-semibold"
							>
								{title}
							</p>
							<span class="h-2.5 w-36 rounded-full bg-muted-foreground/30"></span>
						</div>
					</div>
				</WishlistHeroFrame>
				<WishlistHeroFrame frame={scope.style.heroFrame} layout="mobile">
					<div
						class="preview-mobile-hero grid grid-cols-[72px_minmax(0,1fr)] items-center gap-3"
					>
						{@render photoTile('size-[72px]')}
						<p class="line-clamp-2 font-heading text-xl leading-tight font-semibold">
							{title}
						</p>
					</div>
				</WishlistHeroFrame>
				<div class="grid grid-cols-2 gap-4">
					{@render giftCard()}
					{@render giftCard()}
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	/* A tablet-wide page from 640 px, a phone-wide one below, matching the hero frame layouts and
	   the backdrop strip of `WishlistThemeBackdrop` at those widths. */
	.preview-canvas {
		--preview-band: 84px;

		width: 560px;
	}

	.preview-content {
		padding: 16px;
	}

	.preview-canvas:not([data-background='none']) .preview-content {
		padding-top: var(--preview-band);
	}

	.preview-photo {
		height: var(--preview-band);
	}

	.preview-photo img {
		object-position: var(--photo-focal);
	}

	.preview-photo-dim {
		display: none;
		background: color-mix(in oklab, var(--background) var(--photo-dim), transparent);
	}

	.preview-canvas[data-placement='full'] .preview-photo {
		height: 100%;
	}

	.preview-canvas[data-placement='full'] .preview-photo-dim {
		display: block;
	}

	.preview-motif {
		top: 10px;
		width: 64px;
		height: 64px;
		filter: drop-shadow(3px 3px 0 color-mix(in oklab, var(--m-ink) 22%, transparent));
	}

	.preview-motif[data-side='start'] {
		left: 24px;
		rotate: -8deg;
	}

	.preview-motif[data-side='end'] {
		right: 24px;
		rotate: 8deg;
	}

	.preview-mobile-hero {
		padding: calc(var(--space-2) + var(--hero-mobile-top-extra))
			calc(var(--space-2) + var(--hero-mobile-end-extra)) var(--space-2)
			calc(var(--space-2) + var(--hero-mobile-start-extra));
	}

	@media (width < 640px) {
		.preview-canvas {
			--preview-band: 68px;

			width: 360px;
		}

		.preview-content {
			padding: 12px;
		}

		.preview-motif {
			top: 8px;
			width: 48px;
			height: 48px;
		}

		.preview-canvas[data-placement='full'] .preview-photo {
			height: var(--preview-band);
		}

		.preview-canvas[data-placement='full'] .preview-photo-dim {
			display: none;
		}
	}
</style>
