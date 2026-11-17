<script module lang="ts">
	import type { ComponentProps } from 'svelte';
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import StoryKeyboardHints from '$lib/storybook/StoryKeyboardHints.svelte';
	import KeyboardHint from '$lib/storybook/KeyboardHint.svelte';
	import {
		centeredCropRect,
		normalizedCropAspect,
		zoomCropRect,
		type ImageCropRect,
	} from '$lib/modules/images/index.js';
	import CropPanSurface from './CropPanSurface.svelte';

	type CropPanSurfaceArgs = Partial<
		Omit<ComponentProps<typeof CropPanSurface>, 'cropRect' | 'onchange'>
	>;

	const { Story } = defineMeta({
		title: 'Derived/CropPanSurface',
		component: CropPanSurface,
		tags: ['autodocs'],
	});

	/** Deterministic inline SVG so stories render without network access. */
	function svg(width: number, height: number, fill: string): string {
		const doc = `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'><rect width='100%' height='100%' fill='${fill}'/><circle cx='50%' cy='50%' r='${Math.min(width, height) * 0.3}' fill='rgba(255,255,255,0.55)'/></svg>`;
		return `data:image/svg+xml,${encodeURIComponent(doc)}`;
	}

	// A portrait photo in a landscape card and a landscape photo in a square row
	// thumbnail, so each view has an axis to pan along at the cover zoom.
	const PORTRAIT_RATIO = 3 / 4;
	const PORTRAIT = svg(300, 400, '#8a4b3a');
	const LANDSCAPE_RATIO = 4 / 3;
	const LANDSCAPE = svg(400, 300, '#3b5168');
	const CARD_ASPECT = 4 / 3;
	const THUMB_ASPECT = 1;
	// The panel radius minus its 2px border and the outline's 3px inset keeps the curves parallel.
	const NESTED_OUTLINE_RADIUS = 'rounded-[calc(var(--radius-panel)-5px)]';

	function coverRect(aspect: number, naturalRatio: number): ImageCropRect {
		return centeredCropRect(normalizedCropAspect(aspect, naturalRatio));
	}

	function zoomedOutRect(aspect: number, naturalRatio: number): ImageCropRect {
		const normalizedAspect = normalizedCropAspect(aspect, naturalRatio);
		return zoomCropRect(centeredCropRect(normalizedAspect), normalizedAspect, 0.6);
	}
</script>

<script lang="ts">
	let cardRect = $state(coverRect(CARD_ASPECT, PORTRAIT_RATIO));
	let thumbRect = $state(coverRect(THUMB_ASPECT, LANDSCAPE_RATIO));
	let zoomedOutCardRect = $state(zoomedOutRect(CARD_ASPECT, PORTRAIT_RATIO));
	let motionRect = $state(coverRect(CARD_ASPECT, PORTRAIT_RATIO));
</script>

{#snippet keyboardHints()}
	<StoryKeyboardHints>
		<KeyboardHint keys="← / → / ↑ / ↓" action="Pan (Shift for larger steps)" />
		<KeyboardHint keys="+ / −" action="Zoom in / out around the centre" />
		<KeyboardHint keys="0" action="Recenter at the current zoom" />
	</StoryKeyboardHints>
{/snippet}

<Story name="Card 4:3">
	{#snippet template(args: CropPanSurfaceArgs)}
		<div class="flex flex-col gap-3">
			{@render keyboardHints()}
			<div class="aspect-4/3 w-72 overflow-hidden rounded-panel border-2 border-edge">
				<CropPanSurface
					src={PORTRAIT}
					naturalRatio={PORTRAIT_RATIO}
					aspect={CARD_ASPECT}
					cropRect={cardRect}
					onchange={(rect) => (cardRect = rect)}
					ariaLabel="Výřez pro Kartu"
					outlineClass={NESTED_OUTLINE_RADIUS}
					hintLabel="Posuňte tažením"
					tokenScope="wishlist"
					{...args}
				/>
			</div>
		</div>
	{/snippet}
</Story>

<Story name="List thumbnail 1:1">
	{#snippet template(args: CropPanSurfaceArgs)}
		<div class="flex flex-col gap-3">
			{@render keyboardHints()}
			<div class="size-48 overflow-hidden rounded-panel border-2 border-edge">
				<CropPanSurface
					src={LANDSCAPE}
					naturalRatio={LANDSCAPE_RATIO}
					aspect={THUMB_ASPECT}
					cropRect={thumbRect}
					onchange={(rect) => (thumbRect = rect)}
					ariaLabel="Výřez pro Seznam"
					outlineClass={NESTED_OUTLINE_RADIUS}
					hintLabel="Posuňte"
					tokenScope="wishlist"
					{...args}
				/>
			</div>
		</div>
	{/snippet}
</Story>

<Story name="Zoomed out with fill">
	{#snippet template(args: CropPanSurfaceArgs)}
		<div class="aspect-4/3 w-72 overflow-hidden rounded-panel border-2 border-edge">
			<CropPanSurface
				src={PORTRAIT}
				naturalRatio={PORTRAIT_RATIO}
				aspect={CARD_ASPECT}
				cropRect={zoomedOutCardRect}
				onchange={(rect) => (zoomedOutCardRect = rect)}
				ariaLabel="Výřez pro Kartu"
				outlineClass={NESTED_OUTLINE_RADIUS}
				hintLabel="Posuňte tažením"
				fillColor="#f4e9dc"
				{...args}
			/>
		</div>
	{/snippet}
</Story>

<Story name="Disabled">
	{#snippet template(args: CropPanSurfaceArgs)}
		<div class="aspect-4/3 w-72 overflow-hidden rounded-panel border-2 border-edge">
			<CropPanSurface
				src={PORTRAIT}
				naturalRatio={PORTRAIT_RATIO}
				aspect={CARD_ASPECT}
				cropRect={coverRect(CARD_ASPECT, PORTRAIT_RATIO)}
				onchange={() => {}}
				ariaLabel="Výřez pro Kartu"
				outlineClass={NESTED_OUTLINE_RADIUS}
				hintLabel="Posuňte tažením"
				disabled
				{...args}
			/>
		</div>
	{/snippet}
</Story>

<!-- Drag to review the hint fading out while dragging and back in on release. -->
<Story name="Motion">
	{#snippet template(args: CropPanSurfaceArgs)}
		<div class="aspect-4/3 w-72 overflow-hidden rounded-panel border-2 border-edge">
			<CropPanSurface
				src={PORTRAIT}
				naturalRatio={PORTRAIT_RATIO}
				aspect={CARD_ASPECT}
				cropRect={motionRect}
				onchange={(rect) => (motionRect = rect)}
				ariaLabel="Výřez pro Kartu"
				outlineClass={NESTED_OUTLINE_RADIUS}
				hintLabel="Posuňte tažením"
				{...args}
			/>
		</div>
	{/snippet}
</Story>
