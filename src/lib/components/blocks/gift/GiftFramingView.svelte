<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Badge } from '$lib/components/base/badge/index.js';
	import CropPanSurface from '$lib/components/derived/image-crop/CropPanSurface.svelte';
	import { IMAGE_TOKEN_SCOPES } from '$lib/components/derived/image-frame/index.js';
	import {
		GIFT_CROP_TARGET_SPECS,
		type GiftEditorCropTarget,
	} from '$lib/modules/images/index.js';
	import type { GiftForVisitor } from '$lib/modules/gifts/types.js';
	import GiftCard from './GiftCard.svelte';
	import GiftListItem from './GiftListItem.svelte';
	import GiftFramingControls from './GiftFramingControls.svelte';
	import { GIFT_EDITOR_IMAGE_PLACEMENTS } from './gift_presentation_props.js';
	import { giftFramingLabels, giftFramingTargetLabels } from './gift_framing_labels.js';
	import { giftFramingViewVariants } from './gift_framing_variants.js';
	import type { GiftImageDraft } from './gift_image_gallery_draft.svelte.js';

	interface Props {
		image: GiftImageDraft;
		target: GiftEditorCropTarget;
		/** The gift as visitors see it, so the framing is judged in its real surroundings. */
		previewGift: GiftForVisitor;
		disabled: boolean;
		/** Shows the view's name, aspect and status above it; phones show them in the switcher. */
		showHeading?: boolean;
		/** Id of the keyboard hints describing the pan surface. */
		keyboardHintId: string;
		class?: string;
	}

	let {
		image,
		target,
		previewGift,
		disabled,
		showHeading = true,
		keyboardHintId,
		class: className,
	}: Props = $props();

	const headingId = $props.id();
	const isCard = $derived(target === 'square');
	const styles = $derived(giftFramingViewVariants({ target }));
	const targetLabel = $derived(giftFramingTargetLabels[target]());
	const editorImage = $derived({
		content: panSurface,
		placement: GIFT_EDITOR_IMAGE_PLACEMENTS.instead,
	});
</script>

{#snippet panSurface()}
	{#if image.previewSrc !== null}
		<div class={styles.surfaceBox()}>
			<CropPanSurface
				src={image.previewSrc}
				naturalRatio={image.naturalRatio}
				aspect={GIFT_CROP_TARGET_SPECS[target].aspect}
				cropRect={image.targetRects[target]}
				onchange={(rect) => image.editCrop(target, rect)}
				onmeasure={(ratio, measuredSrc) => image.measure(ratio, measuredSrc)}
				fillColor={image.bgColor}
				tokenScope={IMAGE_TOKEN_SCOPES.wishlist}
				{disabled}
				ariaLabel={m.gift_image_framing_surface_label({ target: targetLabel })}
				ariaDescribedby={keyboardHintId}
				hintLabel={m.gift_image_framing_drag_hint()}
				outlineClass={styles.outline()}
			/>
		</div>
	{/if}
{/snippet}

<section
	class={styles.root({ class: className })}
	aria-labelledby={showHeading ? headingId : undefined}
	aria-label={showHeading ? undefined : targetLabel}
	data-testid="gift-framing-view-{target}"
>
	{#if showHeading}
		<div class={styles.headingRow()}>
			<h3 id={headingId} class={styles.heading()}>
				<span class={styles.headingName()}>{targetLabel}</span>
				<span class={styles.headingDetail()}>
					{isCard
						? m.gift_image_framing_card_detail()
						: m.gift_image_framing_list_detail()}
				</span>
			</h3>
			<Badge tone="neutral" data-testid="gift-framing-status-{target}">
				{giftFramingLabels[image.framings[target]]()}
			</Badge>
		</div>
	{/if}
	{#if isCard}
		<GiftCard gift={previewGift} role="visitor" {editorImage} />
	{:else}
		<GiftListItem gift={previewGift} role="visitor" {editorImage} />
	{/if}
	<GiftFramingControls {image} {target} {targetLabel} {disabled} />
</section>
