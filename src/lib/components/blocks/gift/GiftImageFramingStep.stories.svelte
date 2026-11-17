<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import type { ComponentProps } from 'svelte';
	import StoryKeyboardHints from '$lib/storybook/StoryKeyboardHints.svelte';
	import KeyboardHint from '$lib/storybook/KeyboardHint.svelte';
	import GiftImageFramingStep from './GiftImageFramingStep.svelte';
	import StoryGiftPageContexts from '$lib/storybook/StoryGiftPageContexts.svelte';
	import { COMPARISON_AVAILABLE, PAINTED_GIFT_IMAGE_URL } from './gift_comparison_fixtures.js';
	import { GiftImageDraft } from './gift_image_gallery_draft.svelte.js';

	type GiftImageFramingStepArgs = Partial<ComponentProps<typeof GiftImageFramingStep>>;

	const { Story } = defineMeta({
		title: 'Blocks/Gift/GiftImageFramingStep',
		component: GiftImageFramingStep,
		args: { position: 1, disabled: false },
	});
</script>

<script lang="ts">
	// The painted fixture photo with no stored framing, so both views start on Vyplnit.
	const image = new GiftImageDraft({
		imageUrl: PAINTED_GIFT_IMAGE_URL,
		imageKey: 'story/painted.svg',
		imageMeta: null,
	});
</script>

{#snippet strip()}
	<p class="text-xs text-muted-foreground">Obrázky · 1 z 8</p>
{/snippet}

<Story name="Side by side">
	{#snippet template(args: GiftImageFramingStepArgs)}
		<StoryGiftPageContexts>
			<StoryKeyboardHints>
				<KeyboardHint keys="← / ↑ / ↓ / →" action="Move the framing" />
				<KeyboardHint keys="+ / −" action="Zoom" />
				<KeyboardHint keys="0" action="Center" />
			</StoryKeyboardHints>
			<div class="w-[64rem]">
				<GiftImageFramingStep
					{image}
					previewGift={COMPARISON_AVAILABLE}
					compact={false}
					{strip}
					{...args}
					position={args.position ?? 1}
					disabled={args.disabled ?? false}
				/>
			</div>
		</StoryGiftPageContexts>
	{/snippet}
</Story>

<Story name="Phone (one view)">
	{#snippet template(args: GiftImageFramingStepArgs)}
		<StoryGiftPageContexts>
			<div class="w-[22rem]">
				<GiftImageFramingStep
					{image}
					previewGift={COMPARISON_AVAILABLE}
					compact
					{strip}
					{...args}
					position={args.position ?? 1}
					disabled={args.disabled ?? false}
				/>
			</div>
		</StoryGiftPageContexts>
	{/snippet}
</Story>
