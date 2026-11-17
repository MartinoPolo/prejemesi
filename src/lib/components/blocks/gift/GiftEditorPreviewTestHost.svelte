<!-- Hosts GiftEditorPreview in the wishlist page contexts its real Card and List row read. -->
<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import StoryGiftPageContexts from '$lib/storybook/StoryGiftPageContexts.svelte';
	import GiftEditorPreview from './GiftEditorPreview.svelte';

	let previewProps: ComponentProps<typeof GiftEditorPreview> = $props();
</script>

<StoryGiftPageContexts>
	<div class="w-72">
		<GiftEditorPreview {...previewProps} />
	</div>
</StoryGiftPageContexts>
