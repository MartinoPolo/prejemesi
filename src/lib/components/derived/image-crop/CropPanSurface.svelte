<script lang="ts">
	import MoveIcon from '@lucide/svelte/icons/move';
	import { cn } from '$lib/utils.js';
	import { Badge } from '$lib/components/base/badge/index.js';
	import ImageFrame from '$lib/components/derived/image-frame/ImageFrame.svelte';
	import {
		IMAGE_FIT_MODES,
		IMAGE_LOAD_PRIORITIES,
		IMAGE_TOKEN_SCOPES,
		type ImageTokenScope,
	} from '$lib/components/derived/image-frame/index.js';
	import {
		cropRectToFocalZoom,
		normalizedCropAspect,
		recenterCropRect,
		type ImageCropRect,
	} from '$lib/modules/images/index.js';
	import { CropPanInteraction } from './crop_pan_interaction.svelte.js';

	interface Props {
		/** Source image being framed. */
		src: string;
		/** The photo's natural width ÷ height; edits wait until it is known. */
		naturalRatio: number | null;
		/** Pixel width ÷ height of the box this surface fills; the window keeps it. */
		aspect: number;
		/** Normalized crop window (0..1) the surface shows. */
		cropRect: ImageCropRect;
		/** Receives user edits that change the window. */
		onchange: (rect: ImageCropRect) => void;
		/** Reports the photo's natural width ÷ height once it loads, with the source it was read from. */
		onmeasure?: (ratio: number, measuredSrc: string) => void;
		/** Fill shown where a zoomed-out window overhangs the photo, as on the rendered surfaces. */
		fillColor?: string | null;
		tokenScope?: ImageTokenScope;
		/** Shows the framing without edits, the outline or the hint. */
		disabled?: boolean;
		/** Accessible name of the pannable surface. */
		ariaLabel: string;
		/** Id of an element describing the keyboard controls. */
		ariaDescribedby?: string;
		/** Centered drag hint; omitted, no hint shows. */
		hintLabel?: string;
		/** Corner radii of the dashed outline, nested inside the parent box's corners. */
		outlineClass?: string;
		class?: string;
	}

	let {
		src,
		naturalRatio,
		aspect,
		cropRect,
		onchange,
		onmeasure,
		fillColor = null,
		tokenScope = IMAGE_TOKEN_SCOPES.global,
		disabled = false,
		ariaLabel,
		ariaDescribedby,
		hintLabel,
		outlineClass = 'rounded-sm',
		class: className,
	}: Props = $props();

	let boxWidth = $state(0);
	let boxHeight = $state(0);

	const normalizedAspect = $derived(normalizedCropAspect(aspect, naturalRatio ?? 1));
	const frame = $derived(cropRectToFocalZoom(cropRect));

	const interaction = new CropPanInteraction({
		shownRect: () => cropRect,
		normalizedAspect: () => normalizedAspect,
		windowBox: () =>
			boxWidth > 0 && boxHeight > 0
				? { left: 0, top: 0, width: boxWidth, height: boxHeight }
				: null,
		disabled: () => disabled || naturalRatio === null,
		recenteredRect: () => recenterCropRect(cropRect),
		onchange: (rect) => onchange(rect),
	});
</script>

<!-- The photo renders through ImageFrame with the window's focal point and zoom,
     exactly as the card and list surfaces do; the surface itself is one focusable
     control (drag, wheel/pinch, arrows/+/−/0). Svelte's a11y table does not count
     `application` as interactive. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
	{@attach interaction.attach}
	bind:clientWidth={boxWidth}
	bind:clientHeight={boxHeight}
	data-testid="crop-pan-surface"
	data-dragging={interaction.dragging ? '' : undefined}
	role="application"
	tabindex={disabled ? -1 : 0}
	aria-label={ariaLabel}
	aria-describedby={ariaDescribedby}
	aria-disabled={disabled}
	class={cn(
		'group @container relative size-full overflow-hidden rounded-[inherit] select-none focus-visible:outline-none',
		!disabled && 'cursor-grab touch-none',
		!disabled && interaction.dragging && 'cursor-grabbing',
		className,
	)}
>
	<ImageFrame
		class="pointer-events-none size-full rounded-[inherit]"
		{src}
		alt=""
		loadPriority={IMAGE_LOAD_PRIORITIES.eager}
		fitMode={IMAGE_FIT_MODES.coverCrop}
		focal={frame.focal}
		zoom={frame.zoom}
		{fillColor}
		{tokenScope}
		onmeasured={(ratio) => onmeasure?.(ratio, src)}
	/>

	{#if !disabled}
		<div
			class={cn(
				'pointer-events-none absolute inset-0.75 border-2 border-dashed border-ring/70',
				'group-focus-visible:border-solid group-focus-visible:border-ring group-focus-visible:ring-3 group-focus-visible:ring-ring/22',
				outlineClass,
			)}
			data-testid="crop-pan-surface-outline"
		></div>

		{#if hintLabel}
			<Badge
				tone="neutral"
				badgeStyle="overlay"
				class={cn(
					'pointer-events-none absolute top-1/2 left-1/2 max-w-[calc(100%-1rem)] -translate-1/2',
					'transition-opacity duration-(--duration-fast) ease-(--ease-out-strong)',
					interaction.dragging && 'opacity-0',
				)}
				aria-hidden="true"
				data-testid="crop-pan-surface-hint"
			>
				<MoveIcon class="size-3 shrink-0" strokeWidth={2.6} aria-hidden="true" />
				<span class="truncate @max-[8.5rem]:sr-only">{hintLabel}</span>
			</Badge>
		{/if}
	{/if}
</div>
