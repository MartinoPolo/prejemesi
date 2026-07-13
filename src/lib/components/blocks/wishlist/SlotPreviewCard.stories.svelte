<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import SlotPreviewCard from './SlotPreviewCard.svelte';
	import { imageMetaToFrameProps } from '$lib/modules/images/index.js';

	const frame = imageMetaToFrameProps(null);

	const { Story } = defineMeta({
		title: 'Blocks/Wishlist/SlotPreviewCard',
		component: SlotPreviewCard,
		tags: ['autodocs'],
		args: { slot: 'card', label: 'Card', src: null, frame, themeEmoji: '🎁' },
	});
</script>

<!-- The editor offers three slots since #116 (D3): card, thumbnail, social. -->
<Story name="All slots (fallback)">
	{#snippet template()}
		<div class="grid w-[28rem] grid-cols-3 gap-3">
			<SlotPreviewCard slot="card" label="Card" src={null} {frame} themeEmoji="🎁" />
			<SlotPreviewCard
				slot="thumbnail"
				label="Thumbnail"
				src={null}
				{frame}
				themeEmoji="🎁"
			/>
			<SlotPreviewCard slot="social" label="Social" src={null} {frame} themeEmoji="🎁" />
		</div>
	{/snippet}
</Story>

<Story name="Active selection">
	{#snippet template()}
		<div class="grid w-[28rem] grid-cols-3 gap-3">
			<SlotPreviewCard slot="card" label="Card" src={null} {frame} themeEmoji="🎄" active />
			<SlotPreviewCard
				slot="thumbnail"
				label="Thumbnail"
				src={null}
				{frame}
				themeEmoji="🎄"
			/>
			<SlotPreviewCard slot="social" label="Social" src={null} {frame} themeEmoji="🎄" />
		</div>
	{/snippet}
</Story>
