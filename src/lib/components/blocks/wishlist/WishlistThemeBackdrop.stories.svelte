<script module lang="ts">
	import type { ComponentProps } from 'svelte';
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { loadWishlistThemeArt } from '$lib/theme/wishlist_theme_art/index.js';
	import {
		DEFAULT_WISHLIST_BACKGROUND,
		WISHLIST_BACKGROUND_MODES,
		WISHLIST_THEME_IDS,
		type WishlistBackground,
	} from '$lib/theme/wishlist_themes.js';
	import WishlistThemeBackdrop from './WishlistThemeBackdrop.svelte';

	type WishlistThemeBackdropArgs = Partial<ComponentProps<typeof WishlistThemeBackdrop>>;

	const { Story } = defineMeta({
		title: 'Blocks/Wishlist/WishlistThemeBackdrop',
		component: WishlistThemeBackdrop,
		tags: ['autodocs'],
		argTypes: {
			mode: { control: 'select', options: [...WISHLIST_BACKGROUND_MODES] },
		},
	});

	// A bundled demo photo, so the custom backdrop renders without an upload.
	const CUSTOM_PHOTO_URL = '/demo/playground/advent.jpg';

	// Full placement with a visible dim and an off-centre focal point exercises every photo control.
	const customFullBackground: WishlistBackground = {
		...DEFAULT_WISHLIST_BACKGROUND,
		mode: 'custom',
		placement: 'full',
		dim: 30,
		focal: { x: 30, y: 40 },
	};
</script>

<!-- The backdrop sizes itself against the `app-content` container and paints behind its
     positioned parent, so every frame recreates that pair; `isolate` keeps it above the canvas. -->
{#snippet frame(
	themeId: (typeof WISHLIST_THEME_IDS)[number] | null,
	args: WishlistThemeBackdropArgs,
	frameClass: string,
	props: ComponentProps<typeof WishlistThemeBackdrop>,
)}
	<div class="[container:app-content/inline-size]">
		<div
			class="relative isolate {frameClass}"
			data-wishlist-theme={themeId}
			data-wishlist-backdrop
		>
			{#if themeId === null}
				<WishlistThemeBackdrop {...args} {...props} />
			{:else}
				{#await loadWishlistThemeArt(themeId) then art}
					<WishlistThemeBackdrop {...args} {...props} {art} />
				{/await}
			{/if}
		</div>
	</div>
{/snippet}

<Story name="All Themes">
	{#snippet template(args: WishlistThemeBackdropArgs)}
		<div class="grid grid-cols-[repeat(auto-fill,minmax(20rem,1fr))] gap-4">
			{#each WISHLIST_THEME_IDS as themeId (themeId)}
				<div class="flex flex-col gap-1">
					<span class="text-xs text-muted-foreground">{themeId}</span>
					{@render frame(themeId, args, 'h-28 overflow-hidden rounded-lg', {
						mode: 'theme',
						art: null,
						imageUrl: null,
						background: DEFAULT_WISHLIST_BACKGROUND,
					})}
				</div>
			{/each}
		</div>
	{/snippet}
</Story>

<Story name="Desktop Gutters">
	{#snippet template(args: WishlistThemeBackdropArgs)}
		<div class="w-[1440px]">
			{@render frame('christmas', {}, 'h-[600px]', {
				mode: 'theme',
				art: null,
				imageUrl: null,
				background: DEFAULT_WISHLIST_BACKGROUND,
				...args,
			})}
		</div>
	{/snippet}
</Story>

<Story name="Custom Photo">
	{#snippet template(args: WishlistThemeBackdropArgs)}
		<div class="w-[1440px]">
			{@render frame(null, {}, 'h-[600px]', {
				mode: 'custom',
				art: null,
				imageUrl: CUSTOM_PHOTO_URL,
				background: customFullBackground,
				...args,
			})}
		</div>
	{/snippet}
</Story>

<Story name="Motion">
	{#snippet template(args: WishlistThemeBackdropArgs)}
		<p class="mb-2 text-xs text-muted-foreground">
			Scroll the frame: motifs drift with the scroll unless reduced motion is requested.
		</p>
		<div class="h-96 w-[1440px] overflow-y-auto [container:app-content/inline-size]">
			<div
				class="relative isolate h-[1600px]"
				data-wishlist-theme="toys"
				data-wishlist-backdrop
			>
				{#await loadWishlistThemeArt('toys') then art}
					<WishlistThemeBackdrop
						mode="theme"
						{art}
						imageUrl={null}
						background={DEFAULT_WISHLIST_BACKGROUND}
						{...args}
					/>
				{/await}
			</div>
		</div>
	{/snippet}
</Story>
