<script lang="ts">
	import { cn } from '$lib/utils.js';
	import * as m from '$lib/paraglide/messages.js';
	import { Skeleton } from '$lib/components/base/skeleton/index.js';
	import {
		resolveAutoFit,
		resolveFrameFill,
		IMAGE_FIT_MODES,
		type ImageFitMode,
		type ImageTokenScope,
	} from './image_frame_fit.js';
	import {
		imageFrameVariants,
		type ImageFrameShape,
		type ImageFrameResolvedFit,
	} from './image_frame_variants.js';

	interface Focal {
		x: number;
		y: number;
	}

	interface Props {
		/** Image source. Null/empty renders the themed fallback. */
		src?: string | null;
		/** Accessible description. Empty string marks the image as decorative. */
		alt: string;
		/** Fit strategy for the box (REQ-1). */
		fitMode?: ImageFitMode;
		/** Focal point (%) honored in cover-crop. */
		focal?: Focal;
		/** Zoom factor (1 = 100%) honored in cover-crop, magnifying toward the focal point. */
		zoom?: number;
		/** Extracted/manual dominant color — tier 1 of the fill chain (REQ-3). */
		fillColor?: string | null;
		/** Scopes the tier-2 fill to the wishlist or the global surface (REQ-3). */
		tokenScope?: ImageTokenScope;
		/** Emoji shown in the empty/error fallback (REQ-4). */
		fallbackEmoji?: string;
		/** Optional faint label under the fallback emoji. */
		fallbackLabel?: string;
		/** Box shape — square inherits radius, circle for avatars. */
		shape?: ImageFrameShape;
		/** Adds keyboard focusability + focus-visible ring (e.g. opens a crop editor). */
		interactive?: boolean;
		/** Force the loading skeleton (e.g. parent still fetching before `src` exists). */
		loading?: boolean;
		class?: string;
	}

	let {
		src = null,
		alt,
		fitMode = IMAGE_FIT_MODES.auto,
		focal = { x: 50, y: 50 },
		zoom = 1,
		fillColor = null,
		tokenScope = 'global',
		fallbackEmoji = '🎁',
		fallbackLabel,
		shape = 'square',
		interactive = false,
		loading = false,
		class: className,
	}: Props = $props();

	// Load progress is tracked against the current `src` so it resets automatically
	// (via $derived) whenever the source changes — no state-syncing $effect needed.
	let loadedSrc = $state<string | null>(null);
	let erroredSrc = $state<string | null>(null);
	let measured = $state<{ src: string; ratio: number } | null>(null);
	let boxWidth = $state(0);
	let boxHeight = $state(0);

	const hasSrc = $derived(src !== null && src.trim() !== '');
	const errored = $derived(hasSrc && erroredSrc === src);
	// Skeleton shows while the image is in flight, or when the parent forces it.
	const pending = $derived(hasSrc && loadedSrc !== src && erroredSrc !== src);
	const showSkeleton = $derived(loading || pending);
	const naturalRatio = $derived(
		measured !== null && measured.src === src ? measured.ratio : null,
	);

	const frameFill = $derived(resolveFrameFill({ fillColor, tokenScope }));
	// Loading takes precedence over the empty/error fallback.
	const showFallback = $derived(!showSkeleton && (!hasSrc || errored));

	const effectiveFit = $derived<ImageFrameResolvedFit>(
		fitMode === IMAGE_FIT_MODES.auto
			? naturalRatio !== null && boxWidth > 0 && boxHeight > 0
				? resolveAutoFit(naturalRatio, boxWidth / boxHeight)
				: IMAGE_FIT_MODES.coverCrop
			: fitMode,
	);

	const styles = $derived(imageFrameVariants({ fit: effectiveFit, shape, interactive }));

	// cover-crop honors the focal point (object-position) and an optional zoom that
	// magnifies toward that same point — together they reproduce a saved manual crop.
	const imageStyle = $derived(
		effectiveFit === IMAGE_FIT_MODES.coverCrop
			? `object-position: ${focal.x}% ${focal.y}%;` +
					(zoom !== 1
						? ` transform: scale(${zoom}); transform-origin: ${focal.x}% ${focal.y}%;`
						: '')
			: undefined,
	);

	const fallbackText = $derived(alt !== '' ? alt : (fallbackLabel ?? m.image_frame_no_image()));

	const interactiveAttrs = $derived(
		interactive ? { role: 'button', tabindex: 0, 'aria-label': alt || fallbackText } : {},
	);

	function handleLoad(event: Event) {
		const img = event.currentTarget as HTMLImageElement;
		if (src !== null && img.naturalWidth > 0 && img.naturalHeight > 0) {
			measured = { src, ratio: img.naturalWidth / img.naturalHeight };
		}
		loadedSrc = src;
	}

	function handleError() {
		erroredSrc = src;
	}
</script>

<div
	class={cn(styles.root(), className)}
	style:--frame-fill={frameFill}
	bind:clientWidth={boxWidth}
	bind:clientHeight={boxHeight}
	{...interactiveAttrs}
>
	{#if showFallback}
		<div class={styles.fallback()} role="img" aria-label={fallbackText}>
			<span class={styles.fallbackIcon()} aria-hidden="true">{fallbackEmoji}</span>
			{#if fallbackLabel}
				<span class={styles.fallbackLabel()}>{fallbackLabel}</span>
			{/if}
		</div>
	{:else}
		{#if showSkeleton}
			<Skeleton
				class={styles.skeleton()}
				style="background-color: var(--frame-fill)"
				role="status"
				aria-label={m.image_frame_loading()}
			/>
		{/if}
		{#if hasSrc}
			<img
				class={styles.image()}
				style={imageStyle}
				{src}
				{alt}
				aria-hidden={alt === '' ? 'true' : undefined}
				onload={handleLoad}
				onerror={handleError}
			/>
		{/if}
	{/if}
</div>
