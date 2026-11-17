<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Badge } from '$lib/components/base/badge/index.js';
	import { Kbd } from '$lib/components/base/kbd/index.js';
	import * as SegmentedToggle from '$lib/components/derived/segmented-toggle/index.js';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import {
		GIFT_EDITOR_CROP_TARGET_VALUES,
		type GiftEditorCropTarget,
	} from '$lib/modules/images/index.js';
	import type { GiftForVisitor } from '$lib/modules/gifts/types.js';
	import GiftImage from './GiftImage.svelte';
	import GiftFramingView from './GiftFramingView.svelte';
	import GiftImageBackgroundSwatches from './GiftImageBackgroundSwatches.svelte';
	import { giftFramingLabels, giftFramingTargetLabels } from './gift_framing_labels.js';
	import { giftFramingStepVariants } from './gift_framing_variants.js';
	import type { GiftImageDraft } from './gift_image_gallery_draft.svelte.js';

	interface Props {
		image: GiftImageDraft;
		/** 1-based position of the image in the gallery. */
		position: number;
		previewGift: GiftForVisitor;
		disabled: boolean;
		/** Phones edit one view at a time at full width. */
		compact: boolean;
		/** The gallery strip, which selects the image being framed. */
		strip: Snippet;
	}

	let { image, position, previewGift, disabled, compact, strip }: Props = $props();

	const styles = giftFramingStepVariants();
	const keyboardHintId = $props.id();
	let compactTarget = $state<GiftEditorCropTarget>('square');
	const otherCompactTarget = $derived<GiftEditorCropTarget>(
		compactTarget === 'square' ? 'thumb' : 'square',
	);
	const copyLabels = {
		square: () => m.gift_image_copy_framing_to_thumb(),
		thumb: () => m.gift_image_copy_framing_to_card(),
	} as const satisfies Record<GiftEditorCropTarget, () => string>;
	const controlsDisabled = $derived(disabled || image.naturalRatio === null);

	function copyFraming(fromTarget: GiftEditorCropTarget, toTarget: GiftEditorCropTarget) {
		if (!controlsDisabled) {
			image.copyFraming(fromTarget, toTarget);
		}
	}
</script>

{#snippet swatches()}
	<GiftImageBackgroundSwatches
		value={image.bgColor}
		{disabled}
		{compact}
		label={m.gift_image_background_position({ position })}
		onchange={(value) => image.chooseBackground(value)}
	/>
{/snippet}

{#snippet copyButton(fromTarget: GiftEditorCropTarget, toTarget: GiftEditorCropTarget)}
	<Button
		intent="outline"
		disabled={controlsDisabled}
		onclick={() => copyFraming(fromTarget, toTarget)}
		data-testid="gift-image-copy-framing-{toTarget}"
	>
		{#if toTarget === 'square'}<ArrowLeftIcon data-icon="inline-start" />{/if}
		{copyLabels[fromTarget]()}
		{#if toTarget === 'thumb'}<ArrowRightIcon data-icon="inline-end" />{/if}
	</Button>
{/snippet}

{#snippet thumbSquare(label: string, sample: keyof typeof giftFramingStepVariants.variants.sample)}
	<span class={styles.sample()}>
		<span class={styles.sampleImage({ sample })}>
			<GiftImage
				class="size-full rounded-none"
				imageUrl={image.previewSrc}
				imageMeta={image.imageMeta}
				target="thumb"
				alt=""
				variant="listThumb"
			/>
		</span>
		{label}
	</span>
{/snippet}

<!-- Describes both pan surfaces; phones have no room for the visible key legend. -->
{#snippet keyboardHints(showKeys: boolean)}
	<p id={keyboardHintId} class={styles.keyboardHints({ keyLegend: showKeys })}>
		<span class="sr-only">{m.image_crop_keyboard_hint()}</span>
		{#if showKeys}
			<span class="contents" aria-hidden="true">
				<Kbd>←</Kbd><Kbd>↑</Kbd><Kbd>↓</Kbd><Kbd>→</Kbd>
				{m.gift_image_framing_keys_pan()} ·
				<Kbd>+</Kbd><Kbd>−</Kbd>
				{m.gift_image_framing_keys_zoom()} ·
				<Kbd>0</Kbd>
				{m.gift_image_framing_keys_center()}
			</span>
		{/if}
	</p>
{/snippet}

{#snippet compactEditor()}
	<SegmentedToggle.Root
		bind:value={compactTarget}
		width="fill"
		aria-label={m.gift_image_framing_view_switch()}
	>
		{#each GIFT_EDITOR_CROP_TARGET_VALUES as target (target)}
			<SegmentedToggle.Item value={target}>
				{giftFramingTargetLabels[target]()}
				<Badge tone="neutral" data-testid="gift-framing-status-{target}">
					{giftFramingLabels[image.framings[target]]()}
				</Badge>
			</SegmentedToggle.Item>
		{/each}
	</SegmentedToggle.Root>
	<GiftFramingView
		{image}
		target={compactTarget}
		{previewGift}
		{disabled}
		showHeading={false}
		{keyboardHintId}
	/>
	<div class={styles.compactActions()}>
		{@render copyButton(compactTarget, otherCompactTarget)}
		{@render swatches()}
	</div>
	{@render keyboardHints(false)}
{/snippet}

{#snippet sideBySideEditor()}
	<div class={styles.sideBySide()}>
		<GiftFramingView
			class={styles.cardView()}
			{image}
			target="square"
			{previewGift}
			{disabled}
			{keyboardHintId}
		/>
		<div class={styles.copyColumn()}>
			{@render copyButton('square', 'thumb')}
			{@render copyButton('thumb', 'square')}
			<p class={styles.note()}>{m.gift_image_copy_framing_note()}</p>
		</div>
		<div class={styles.listColumn()}>
			<GiftFramingView {image} target="thumb" {previewGift} {disabled} {keyboardHintId} />
			<div class={styles.sameSquarePanel()} data-testid="gift-framing-same-square">
				<p class={styles.sameSquareHeading()}>
					{m.gift_image_framing_same_square()}
				</p>
				<div class={styles.sameSquareSamples()}>
					{@render thumbSquare(m.gift_image_framing_reservation(), 'reservation')}
					{@render thumbSquare(m.gift_view_carousel(), 'carousel')}
				</div>
			</div>
		</div>
		<div class={styles.backgroundBar()}>
			<div class={styles.backgroundGroup()}>
				<span class={styles.backgroundLabel()}>
					{m.gift_image_background_position({ position })}
				</span>
				{@render swatches()}
			</div>
			{@render keyboardHints(true)}
		</div>
	</div>
{/snippet}

<div class={styles.root()} data-testid="gift-image-framing-step">
	{@render strip()}
	{#if compact}
		{@render compactEditor()}
	{:else}
		{@render sideBySideEditor()}
	{/if}
</div>
