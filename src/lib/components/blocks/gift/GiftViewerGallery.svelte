<script lang="ts">
	import type { Snippet } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import * as m from '$lib/paraglide/messages.js';
	import ImageFrame from '$lib/components/derived/image-frame/ImageFrame.svelte';
	import {
		IMAGE_TOKEN_SCOPES,
		hasExplicitFrameFill,
	} from '$lib/components/derived/image-frame/index.js';
	import { cn } from '$lib/utils.js';
	import { resolveGiftImageUrl } from '$lib/modules/images/public_url.js';
	import type { GiftImage as GiftGalleryImage } from '$lib/modules/gifts/gift_images.js';
	import { clampGalleryIndex } from '$lib/modules/gifts/gift_gallery.js';
	import GiftImage from './GiftImage.svelte';
	import GiftGalleryArrow from './GiftGalleryArrow.svelte';
	import GiftGalleryIndicator from './GiftGalleryIndicator.svelte';
	import { browseKeepingArrowFocus, type GalleryStep } from './gift_gallery_arrows.js';
	import { giftViewerVariants } from './gift_viewer_variants.js';

	interface Props {
		images: readonly GiftGalleryImage[];
		alt: string;
		/** The image the card showed when the viewer opened. */
		initialIndex: number;
		/** Content layered over the photo, such as the state badges. */
		photoOverlay?: Snippet;
	}

	let { images, alt, initialIndex, photoOverlay }: Props = $props();

	// Stored image metadata carries no dimensions, so the photo column uses this ratio until the
	// images decode.
	const FALLBACK_PHOTO_ASPECT_RATIO = 4 / 3;

	const count = $derived(images.length);
	// The viewer mounts fresh on every open, so the opening index is read once.
	// svelte-ignore state_referenced_locally
	let index = $state(clampGalleryIndex(initialIndex, images.length));
	const measuredAspectRatios = new SvelteMap<string, number>();
	const thumbnailElements: (HTMLElement | undefined)[] = [];
	let previousArrow = $state<HTMLElement | null>(null);
	let nextArrow = $state<HTMLElement | null>(null);

	const imageSources = $derived(
		images.map((image) => resolveGiftImageUrl(image.imageUrl, image.imageKey)),
	);
	// The column takes the widest image's width at the height cap, so browsing never resizes the
	// dialog; narrower images letterbox on the frame fill.
	const photoAspectRatio = $derived.by(() => {
		const ratios = imageSources.flatMap((source) => {
			const ratio = source === null ? undefined : measuredAspectRatios.get(source);
			return ratio === undefined ? [] : [ratio];
		});
		return ratios.length === 0 ? FALLBACK_PHOTO_ASPECT_RATIO : Math.max(...ratios);
	});
	const explicitPhotoFill = $derived(explicitFill(images[index]));
	const styles = $derived(giftViewerVariants({ hasExplicitFill: explicitPhotoFill !== null }));

	function explicitFill(image: GiftGalleryImage | undefined): string | null {
		const fillColor = image?.imageMeta?.bgColor;
		return hasExplicitFrameFill(fillColor) ? fillColor : null;
	}

	function showImage(imageIndex: number) {
		index = clampGalleryIndex(imageIndex, count);
		thumbnailElements[index]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
	}

	function browse(step: GalleryStep) {
		browseKeepingArrowFocus(
			step,
			() => ({ previous: previousArrow, next: nextArrow }),
			() => showImage(index + step),
		);
	}

	function rememberAspectRatio(source: string | null, aspectRatio: number) {
		if (source !== null) {
			measuredAspectRatios.set(source, aspectRatio);
		}
	}

	function isEditableTarget(target: EventTarget | null): boolean {
		return (
			target instanceof HTMLElement &&
			(target.isContentEditable || target.closest('input, textarea, select') !== null)
		);
	}

	// Arrow keys browse while the dialog is open, wherever focus sits inside it.
	function listenForArrowKeys(galleryRoot: HTMLElement) {
		const dialogContent = galleryRoot.closest<HTMLElement>('[data-slot="dialog-content"]');
		if (dialogContent === null) {
			return;
		}
		const browseWithKeys = (event: KeyboardEvent) => {
			if (
				(event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') ||
				event.altKey ||
				event.ctrlKey ||
				event.metaKey ||
				event.shiftKey ||
				event.defaultPrevented ||
				isEditableTarget(event.target)
			) {
				return;
			}
			event.preventDefault();
			browse(event.key === 'ArrowRight' ? 1 : -1);
		};
		dialogContent.addEventListener('keydown', browseWithKeys);
		return () => dialogContent.removeEventListener('keydown', browseWithKeys);
	}
</script>

<div class={styles.galleryColumn()} data-testid="gift-viewer-gallery" {@attach listenForArrowKeys}>
	<figure
		class={cn(styles.photoRegion(), styles.galleryPhotoRegion())}
		data-testid="gift-viewer-photo"
		data-gallery-index={index}
		style:--photo-aspect-ratio={photoAspectRatio}
		style:--frame-fill={explicitPhotoFill ?? undefined}
	>
		<div class={styles.photoSizer()}></div>
		{#each images as image, imageIndex (imageIndex)}
			{@const source = imageSources[imageIndex] ?? null}
			<ImageFrame
				natural
				class={cn(styles.photo(), imageIndex !== index && 'invisible')}
				src={source}
				{alt}
				fillColor={explicitFill(image)}
				tokenScope={IMAGE_TOKEN_SCOPES.wishlist}
				eagerLoading={imageIndex === index}
				onmeasured={(aspectRatio) => rememberAspectRatio(source, aspectRatio)}
			/>
		{/each}
		<GiftGalleryIndicator {count} {index} kind="counter" class={styles.galleryCounter()} />
		<!-- Only arrows that lead somewhere render, so they show where in the gallery the viewer is. -->
		{#if index > 0}
			<GiftGalleryArrow
				bind:ref={previousArrow}
				direction="previous"
				class={cn(styles.galleryArrow(), styles.galleryPreviousArrow())}
				testId="gift-viewer-gallery-previous"
				onclick={() => browse(-1)}
			/>
		{/if}
		{#if index < count - 1}
			<GiftGalleryArrow
				bind:ref={nextArrow}
				direction="next"
				class={cn(styles.galleryArrow(), styles.galleryNextArrow())}
				testId="gift-viewer-gallery-next"
				onclick={() => browse(1)}
			/>
		{/if}
		{@render photoOverlay?.()}
	</figure>

	<div
		class={styles.galleryStrip()}
		role="group"
		aria-label={m.gift_gallery_thumbnails_label()}
		data-testid="gift-viewer-thumbnails"
	>
		{#each images as image, imageIndex (imageIndex)}
			<button
				bind:this={thumbnailElements[imageIndex]}
				type="button"
				class={styles.galleryThumb()}
				aria-label={m.gift_gallery_position({ position: imageIndex + 1, count })}
				aria-current={imageIndex === index}
				data-testid="gift-viewer-thumbnail"
				onclick={() => showImage(imageIndex)}
			>
				<GiftImage
					class="size-full rounded-none"
					imageUrl={imageSources[imageIndex] ?? null}
					imageMeta={image.imageMeta}
					target="thumb"
					alt=""
					variant="listThumb"
				/>
			</button>
		{/each}
	</div>
</div>
