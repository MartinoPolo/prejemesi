<script lang="ts">
	import { RadioGroup as RadioGroupPrimitive } from 'bits-ui';
	import * as m from '$lib/paraglide/messages.js';
	import { loadWishlistThemeArt } from '$lib/theme/wishlist_theme_art/index.js';
	import {
		wishlistThemeDescription,
		wishlistThemeName,
	} from '$lib/theme/wishlist_theme_messages.js';
	import {
		WISHLIST_THEMES,
		WISHLIST_THEME_IDS,
		WISHLIST_VIEWER_MODES,
		isWishlistThemeId,
		type WishlistThemeId,
		type WishlistViewerMode,
	} from '$lib/theme/wishlist_themes.js';
	import type { Palette } from '$lib/theme/palettes.js';
	import { wishlistAppearanceChoiceVariants } from './wishlist_appearance_choice_variants.js';

	interface WishlistThemeGalleryProps {
		value: WishlistThemeId | null;
		onchange: (themeId: WishlistThemeId | null) => void;
		/** Palette the "no theme" card previews: the list's current palette. */
		palette: Palette;
		labelledBy: string;
		disabled?: boolean;
	}

	/** Radio value of the "no theme" card; never a registry id. */
	const NO_THEME_VALUE = 'no-theme';

	let {
		value,
		onchange,
		palette,
		labelledBy,
		disabled = false,
	}: WishlistThemeGalleryProps = $props();

	const styles = wishlistAppearanceChoiceVariants();
	const idPrefix = $props.id();
	let galleryElement = $state<HTMLElement | null>(null);
	let thumbnailMotifs = $state.raw<Partial<Record<WishlistThemeId, string>>>({});
	// Bits UI writes the clicked value through the binding first; mirroring the prop keeps the
	// rendered selection controlled by the draft.
	let selectedValue = $derived<string>(value ?? NO_THEME_VALUE);

	function handleValueChange(nextValue: string) {
		if (nextValue === NO_THEME_VALUE) {
			onchange(null);
			return;
		}
		if (isWishlistThemeId(nextValue)) {
			onchange(nextValue);
			return;
		}
		selectedValue = value ?? NO_THEME_VALUE;
	}

	async function loadThumbnailMotifs() {
		const results = await Promise.allSettled(
			WISHLIST_THEME_IDS.map(async (themeId) => {
				const art = await loadWishlistThemeArt(themeId);
				return [themeId, art.motifs[0]] as const;
			}),
		);
		const loaded: Partial<Record<WishlistThemeId, string>> = {};
		for (const result of results) {
			if (result.status === 'fulfilled' && result.value[1] !== undefined) {
				loaded[result.value[0]] = result.value[1];
			}
		}
		thumbnailMotifs = loaded;
	}

	// The settings dialog mounts every tab up front; the art downloads only once the gallery shows.
	$effect(() => {
		if (galleryElement === null) {
			return;
		}
		const observer = new IntersectionObserver((entries) => {
			if (entries.some((entry) => entry.isIntersecting)) {
				observer.disconnect();
				void loadThumbnailMotifs();
			}
		});
		observer.observe(galleryElement);
		return () => observer.disconnect();
	});
</script>

<!-- One half of a tile: the motif backdrop (or the bare palette page) forced into one mode, so
     every tile shows what light-mode and dark-mode visitors get. -->
{#snippet modeVariant(
	mode: WishlistViewerMode,
	variantPalette: Palette,
	themeId: WishlistThemeId | null,
)}
	{@const motif = themeId === null ? undefined : thumbnailMotifs[themeId]}
	<span
		class={['relative block overflow-hidden', mode === 'dark' && 'dark']}
		data-light-scope={mode === 'light' ? '' : undefined}
		data-testid="wishlist-theme-variant"
		data-mode={mode}
	>
		<span
			class="absolute inset-0 [background:var(--theme-backdrop,var(--background))]"
			data-palette={variantPalette}
			data-wishlist-theme={themeId ?? undefined}
		>
			{#if motif !== undefined}
				<svg
					viewBox="0 0 100 100"
					class="absolute bottom-[8%] left-1/2 h-[64%] -translate-x-1/2 overflow-visible"
				>
					<!-- eslint-disable-next-line svelte/no-at-html-tags -- static, trusted theme art -->
					{@html motif}
				</svg>
			{:else if themeId === null}
				<span
					class="absolute inset-x-[22%] top-[22%] bottom-0 rounded-t-sm border-2 border-b-0 border-ink bg-card"
				></span>
			{/if}
		</span>
	</span>
{/snippet}

{#snippet tile(
	itemValue: string,
	tilePalette: Palette,
	themeId: WishlistThemeId | null,
	name: string,
	description: string,
)}
	<RadioGroupPrimitive.Item
		value={itemValue}
		class={styles.item()}
		aria-labelledby="{idPrefix}-{itemValue}-name"
		aria-describedby="{idPrefix}-{itemValue}-description"
	>
		<span class="grid aspect-[2/1] w-full grid-cols-2 border-b-2 border-ink" aria-hidden="true">
			{#each WISHLIST_VIEWER_MODES as mode (mode)}
				{@render modeVariant(mode, tilePalette, themeId)}
			{/each}
		</span>
		<span class={styles.label({ class: 'min-h-7 items-center text-center' })}>
			<span id="{idPrefix}-{itemValue}-name">{name}</span>
			<span id="{idPrefix}-{itemValue}-description" class="sr-only">{description}</span>
		</span>
	</RadioGroupPrimitive.Item>
{/snippet}

<RadioGroupPrimitive.Root
	bind:ref={galleryElement}
	bind:value={selectedValue}
	onValueChange={handleValueChange}
	aria-labelledby={labelledBy}
	{disabled}
	loop
	class={styles.root({ class: 'grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3' })}
	data-testid="wishlist-theme-gallery"
>
	{#each WISHLIST_THEME_IDS as themeId (themeId)}
		{@render tile(
			themeId,
			WISHLIST_THEMES[themeId].palette,
			themeId,
			wishlistThemeName(themeId),
			wishlistThemeDescription(themeId),
		)}
	{/each}
	{@render tile(
		NO_THEME_VALUE,
		palette,
		null,
		m.wishlist_appearance_no_theme(),
		m.wishlist_appearance_no_theme_description(),
	)}
</RadioGroupPrimitive.Root>
