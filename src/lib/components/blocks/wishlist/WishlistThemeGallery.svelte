<script lang="ts">
	import { RadioGroup as RadioGroupPrimitive } from 'bits-ui';
	import * as m from '$lib/paraglide/messages.js';
	import { loadWishlistThemeArt } from '$lib/theme/wishlist_theme_art/index.js';
	import { wishlistThemeName } from '$lib/theme/wishlist_theme_messages.js';
	import {
		WISHLIST_THEMES,
		WISHLIST_THEME_IDS,
		isWishlistThemeId,
		type WishlistThemeId,
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
	let galleryElement = $state<HTMLElement | null>(null);
	let thumbnailMotifs = $state.raw<Partial<Record<WishlistThemeId, readonly string[]>>>({});
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
				return [themeId, art.motifs.slice(0, 2)] as const;
			}),
		);
		const loaded: Partial<Record<WishlistThemeId, readonly string[]>> = {};
		for (const result of results) {
			if (result.status === 'fulfilled') {
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

{#snippet thumbnailPaper()}
	<span
		class="absolute inset-x-[28%] top-[18%] bottom-[14%] flex flex-col gap-1 rounded-sm border-2 border-ink bg-card p-1.5"
	>
		<span class="h-1.5 w-3/4 rounded-full bg-primary"></span>
		<span class="h-1 w-1/2 rounded-full bg-muted-foreground/40"></span>
		<span class="mt-auto grid grid-cols-2 gap-1">
			<span class="aspect-square rounded-[3px] border border-ink bg-muted"></span>
			<span class="aspect-square rounded-[3px] border border-ink bg-muted"></span>
		</span>
	</span>
{/snippet}

<RadioGroupPrimitive.Root
	bind:ref={galleryElement}
	bind:value={selectedValue}
	onValueChange={handleValueChange}
	aria-labelledby={labelledBy}
	{disabled}
	loop
	class={styles.root()}
	data-testid="wishlist-theme-gallery"
>
	<RadioGroupPrimitive.Item value={NO_THEME_VALUE} class={styles.item()}>
		<span
			class="relative block aspect-[4/3] w-full border-b-2 border-ink bg-background"
			data-palette={palette}
			aria-hidden="true"
		>
			{@render thumbnailPaper()}
		</span>
		<span class={styles.label()}>{m.wishlist_appearance_no_theme()}</span>
	</RadioGroupPrimitive.Item>
	{#each WISHLIST_THEME_IDS as themeId (themeId)}
		{@const motifs = thumbnailMotifs[themeId] ?? []}
		<RadioGroupPrimitive.Item value={themeId} class={styles.item()}>
			<span
				class="relative block aspect-[4/3] w-full overflow-hidden border-b-2 border-ink [background:var(--theme-backdrop,var(--background))]"
				data-palette={WISHLIST_THEMES[themeId].palette}
				data-wishlist-theme={themeId}
				aria-hidden="true"
			>
				{#each motifs as motif, index (index)}
					<svg
						viewBox="0 0 100 100"
						class="absolute size-[34%] overflow-visible data-[side=end]:right-[-6%] data-[side=end]:bottom-[4%] data-[side=start]:top-[4%] data-[side=start]:left-[-6%]"
						data-side={index === 0 ? 'start' : 'end'}
					>
						<!-- eslint-disable-next-line svelte/no-at-html-tags -- static, trusted theme art -->
						{@html motif}
					</svg>
				{/each}
				{@render thumbnailPaper()}
			</span>
			<span class={styles.label()}>{wishlistThemeName(themeId)}</span>
		</RadioGroupPrimitive.Item>
	{/each}
</RadioGroupPrimitive.Root>
