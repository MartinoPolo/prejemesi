<script lang="ts">
	import { RadioGroup as RadioGroupPrimitive } from 'bits-ui';
	import * as m from '$lib/paraglide/messages.js';
	import {
		isWishlistLibraryImageId,
		wishlistLibraryImagesForTheme,
		wishlistLibraryImageThumbnailUrl,
		type WishlistLibraryImageVariant,
	} from '$lib/theme/wishlist_background_library.js';
	import { wishlistThemeName } from '$lib/theme/wishlist_theme_messages.js';
	import type { WishlistThemeId } from '$lib/theme/wishlist_themes.js';
	import { wishlistAppearanceChoiceVariants } from './wishlist_appearance_choice_variants.js';

	interface WishlistBackgroundLibraryPickerProps {
		value: string | null;
		/** The list's theme, whose images lead the picker. */
		themeId: WishlistThemeId | null;
		onchange: (libraryImageId: string) => void;
		labelledBy: string;
		disabled?: boolean;
	}

	const VARIANT_LABELS = {
		illustrated: m.wishlist_appearance_background_library_illustrated,
		photo: m.wishlist_appearance_background_library_photo,
	} satisfies Record<WishlistLibraryImageVariant, () => string>;

	let {
		value,
		themeId,
		onchange,
		labelledBy,
		disabled = false,
	}: WishlistBackgroundLibraryPickerProps = $props();

	const styles = wishlistAppearanceChoiceVariants();
	const idPrefix = $props.id();
	const libraryImages = $derived(wishlistLibraryImagesForTheme(themeId));
	// Bits UI writes the clicked value through the binding first; mirroring the prop keeps the
	// rendered selection controlled by the draft.
	let selectedValue = $derived<string>(value ?? '');

	function handleValueChange(nextValue: string) {
		if (isWishlistLibraryImageId(nextValue)) {
			onchange(nextValue);
			return;
		}
		selectedValue = value ?? '';
	}
</script>

<RadioGroupPrimitive.Root
	bind:value={selectedValue}
	onValueChange={handleValueChange}
	aria-labelledby={labelledBy}
	{disabled}
	loop
	class={styles.root()}
	data-testid="wishlist-background-library"
>
	{#each libraryImages as libraryImage (libraryImage.id)}
		<RadioGroupPrimitive.Item
			value={libraryImage.id}
			class={styles.item()}
			aria-labelledby="{idPrefix}-{libraryImage.id}-theme {idPrefix}-{libraryImage.id}-variant"
		>
			<img
				src={wishlistLibraryImageThumbnailUrl(libraryImage)}
				alt=""
				loading="lazy"
				decoding="async"
				class="block aspect-video w-full border-b-2 border-ink object-cover"
			/>
			<span class={styles.label()}>
				<span id="{idPrefix}-{libraryImage.id}-theme">
					{wishlistThemeName(libraryImage.themeId)}
				</span>
				<span id="{idPrefix}-{libraryImage.id}-variant" class={styles.description()}>
					{VARIANT_LABELS[libraryImage.variant]()}
				</span>
			</span>
		</RadioGroupPrimitive.Item>
	{/each}
</RadioGroupPrimitive.Root>
