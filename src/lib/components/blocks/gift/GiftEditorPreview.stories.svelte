<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import type { ComponentProps } from 'svelte';
	import GiftEditorPreview from './GiftEditorPreview.svelte';
	import StoryGiftPageContexts from '$lib/storybook/StoryGiftPageContexts.svelte';
	import { BASE_STORY_GIFT, COMPARISON_AVAILABLE } from './gift_comparison_fixtures.js';

	type GiftEditorPreviewArgs = Partial<ComponentProps<typeof GiftEditorPreview>>;

	const { Story } = defineMeta({
		title: 'Blocks/Gift/GiftEditorPreview',
		component: GiftEditorPreview,
		args: { editable: true, disabled: false, onedit: () => {} },
	});

	// A painted image so the entry sticker sits over a real photo, as in the editor.
	const WITH_IMAGE = COMPARISON_AVAILABLE;
	// No image: the card shows its fallback and offers no edit entry.
	const WITHOUT_IMAGE = BASE_STORY_GIFT;
</script>

<Story name="With image">
	{#snippet template(args: GiftEditorPreviewArgs)}
		<StoryGiftPageContexts>
			<div class="w-72">
				<GiftEditorPreview
					{...args}
					gift={WITH_IMAGE}
					editable={args.editable ?? true}
					disabled={args.disabled ?? false}
					onedit={() => {}}
				/>
			</div>
		</StoryGiftPageContexts>
	{/snippet}
</Story>

<Story name="Without image" args={{ editable: false }}>
	{#snippet template(args: GiftEditorPreviewArgs)}
		<StoryGiftPageContexts>
			<div class="w-72">
				<GiftEditorPreview
					{...args}
					gift={WITHOUT_IMAGE}
					editable={args.editable ?? false}
					disabled={args.disabled ?? false}
					onedit={() => {}}
				/>
			</div>
		</StoryGiftPageContexts>
	{/snippet}
</Story>
