<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import WishlistCropEditor from './WishlistCropEditor.svelte';

	const { Story } = defineMeta({
		title: 'Blocks/Wishlist/WishlistCropEditor',
		component: WishlistCropEditor,
		tags: ['autodocs'],
	});

	function noop() {}
</script>

<Story name="No image (upload)">
	<div class="max-w-2xl">
		<WishlistCropEditor
			imageKey={null}
			imageSlots={null}
			themeEmoji="🎁"
			title="Sample wishlist"
			onsave={noop}
		/>
	</div>
</Story>
