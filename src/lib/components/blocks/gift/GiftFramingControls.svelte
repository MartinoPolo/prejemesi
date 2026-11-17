<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Slider } from '$lib/components/base/slider/index.js';
	import * as SegmentedToggle from '$lib/components/derived/segmented-toggle/index.js';
	import {
		CROP_ZOOM_STEP,
		cropZoomControl,
	} from '$lib/components/derived/image-crop/crop_zoom_control.js';
	import ZoomInIcon from '@lucide/svelte/icons/zoom-in';
	import ZoomOutIcon from '@lucide/svelte/icons/zoom-out';
	import LocateFixedIcon from '@lucide/svelte/icons/locate-fixed';
	import {
		GIFT_CROP_TARGET_SPECS,
		GIFT_FRAMINGS,
		normalizedCropAspect,
		recenterCropRect,
		zoomCropRect,
		type GiftEditorCropTarget,
	} from '$lib/modules/images/index.js';
	import type { GiftImageDraft } from './gift_image_gallery_draft.svelte.js';

	interface Props {
		image: GiftImageDraft;
		target: GiftEditorCropTarget;
		/** Accessible name of the view these controls frame, such as „Karta“. */
		targetLabel: string;
		disabled: boolean;
		class?: string;
	}

	let { image, target, targetLabel, disabled, class: className }: Props = $props();

	const ready = $derived(image.naturalRatio !== null);
	const controlsDisabled = $derived(disabled || !ready);
	const normalizedAspect = $derived(
		normalizedCropAspect(GIFT_CROP_TARGET_SPECS[target].aspect, image.naturalRatio ?? 1),
	);
	const rect = $derived(image.targetRects[target]);
	const zoomControl = $derived(cropZoomControl(rect, normalizedAspect));
	const framing = $derived(image.framings[target]);

	// SegmentedToggle writes the clicked value before onValueChange; a refused change resets it, and
	// a custom framing selects no preset.
	let selectedPreset = $derived<string>(framing === GIFT_FRAMINGS.custom ? '' : framing);

	function applyPreset(value: string) {
		if (controlsDisabled || (value !== GIFT_FRAMINGS.fill && value !== GIFT_FRAMINGS.whole)) {
			selectedPreset = framing === GIFT_FRAMINGS.custom ? '' : framing;
			return;
		}
		image.applyPreset(target, value);
	}

	function zoomTo(zoom: number) {
		if (!controlsDisabled) {
			image.editCrop(target, zoomCropRect(rect, normalizedAspect, zoom));
		}
	}

	function recenter() {
		if (!controlsDisabled) {
			image.editCrop(target, recenterCropRect(rect));
		}
	}
</script>

<div
	class={cn('flex min-w-0 items-center gap-(--nested-control-gap)', className)}
	data-testid="gift-framing-controls-{target}"
>
	<SegmentedToggle.Root
		bind:value={selectedPreset}
		onValueChange={applyPreset}
		aria-label={m.gift_image_framing_label({ target: targetLabel })}
		class="shrink-0"
	>
		<SegmentedToggle.Item value={GIFT_FRAMINGS.fill} disabled={controlsDisabled}>
			{m.image_fit_fill()}
		</SegmentedToggle.Item>
		<SegmentedToggle.Item value={GIFT_FRAMINGS.whole} disabled={controlsDisabled}>
			{m.image_crop_whole()}
		</SegmentedToggle.Item>
	</SegmentedToggle.Root>
	<div class="flex min-w-0 flex-1 items-center gap-1">
		<Button
			intent="ghost"
			class="max-sm:hidden"
			format="icon"
			disabled={controlsDisabled || !zoomControl.canZoomOut}
			onclick={() => zoomTo(zoomControl.zoom - CROP_ZOOM_STEP)}
			aria-label={m.image_crop_zoom_out()}
		>
			<ZoomOutIcon data-icon="solo" />
		</Button>
		<Slider
			class="min-w-12 flex-1"
			value={zoomControl.percent}
			min={zoomControl.minPercent}
			max={zoomControl.maxPercent}
			step={1}
			disabled={controlsDisabled}
			onValueChange={(value: number) => zoomTo(value / 100)}
			aria-label={m.image_crop_zoom_label()}
			aria-valuetext="{zoomControl.percent} %"
			data-testid="gift-framing-zoom-{target}"
		/>
		<Button
			intent="ghost"
			class="max-sm:hidden"
			format="icon"
			disabled={controlsDisabled || !zoomControl.canZoomIn}
			onclick={() => zoomTo(zoomControl.zoom + CROP_ZOOM_STEP)}
			aria-label={m.image_crop_zoom_in()}
		>
			<ZoomInIcon data-icon="solo" />
		</Button>
	</div>
	<Button
		intent="outline"
		format="icon"
		class="shrink-0"
		disabled={controlsDisabled}
		onclick={recenter}
		aria-label={m.image_crop_center()}
		title={m.image_crop_center()}
	>
		<LocateFixedIcon data-icon="solo" />
	</Button>
</div>
