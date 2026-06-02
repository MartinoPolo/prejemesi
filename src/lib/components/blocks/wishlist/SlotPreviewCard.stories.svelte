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

<Story name="All slots (fallback)">
	<div class="grid w-[28rem] grid-cols-2 gap-3 sm:grid-cols-4">
		<SlotPreviewCard slot="card" label="Card" src={null} {frame} themeEmoji="🎁" />
		<SlotPreviewCard slot="thumbnail" label="Thumbnail" src={null} {frame} themeEmoji="🎁" />
		<SlotPreviewCard slot="banner" label="Header" src={null} {frame} themeEmoji="🎁" />
		<SlotPreviewCard slot="social" label="Social" src={null} {frame} themeEmoji="🎁" />
	</div>
</Story>

<Story name="Active selection">
	<div class="grid w-[28rem] grid-cols-2 gap-3 sm:grid-cols-4">
		<SlotPreviewCard slot="card" label="Card" src={null} {frame} themeEmoji="🎄" active />
		<SlotPreviewCard slot="thumbnail" label="Thumbnail" src={null} {frame} themeEmoji="🎄" />
		<SlotPreviewCard slot="banner" label="Header" src={null} {frame} themeEmoji="🎄" />
		<SlotPreviewCard slot="social" label="Social" src={null} {frame} themeEmoji="🎄" />
	</div>
</Story>
