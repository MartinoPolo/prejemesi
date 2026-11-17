<script lang="ts">
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import * as SegmentedToggle from '$lib/components/derived/segmented-toggle/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils.js';
	import { setUserDarkWishlistBackground } from '$lib/modules/settings/settings.remote.js';
	import {
		DARK_WISHLIST_BACKGROUNDS,
		DEFAULT_DARK_WISHLIST_BACKGROUND,
		isDarkWishlistBackground,
		type DarkWishlistBackground,
	} from '$lib/theme/dark_wishlist_background.js';
	import { RootAppearancePreference } from '$lib/theme/root_appearance_preference.svelte.js';

	const labelId = $props.id();
	const darkWishlistBackground = new RootAppearancePreference<DarkWishlistBackground>({
		datasetKey: 'darkWishlistBackground',
		isValue: isDarkWishlistBackground,
		fallback: DEFAULT_DARK_WISHLIST_BACKGROUND,
		persist: setUserDarkWishlistBackground,
		description: 'dark wishlist background',
	});

	const labels: Record<DarkWishlistBackground, () => string> = {
		wishlist: m.dark_wishlist_background_wishlist,
		app: m.dark_wishlist_background_app,
		tint: m.dark_wishlist_background_tint,
	};
</script>

<div class="flex flex-col gap-2">
	<Label id={labelId}>{m.dark_wishlist_background_label()}</Label>
	<!-- Three labels cannot share one phone-width row at the fixed control height, so they stack. -->
	<SegmentedToggle.Root
		width="fill"
		aria-labelledby={labelId}
		value={darkWishlistBackground.selected}
		onValueChange={(value) => darkWishlistBackground.select(value)}
		class={cn(
			'max-sm:grid max-sm:h-auto max-sm:grid-cols-1',
			!darkWishlistBackground.synchronized && 'invisible',
		)}
		aria-hidden={!darkWishlistBackground.synchronized}
	>
		{#each DARK_WISHLIST_BACKGROUNDS as background (background)}
			<SegmentedToggle.Item value={background} class="max-sm:h-(--size-control-lg)">
				{labels[background]()}
			</SegmentedToggle.Item>
		{/each}
	</SegmentedToggle.Root>
	<HelpText>{m.dark_wishlist_background_help()}</HelpText>
</div>
