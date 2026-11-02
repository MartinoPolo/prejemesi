<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import type { Palette } from '$lib/theme/palettes.js';
	import { loadWishlistThemeArt } from '$lib/theme/wishlist_theme_art/index.js';
	import {
		WISHLIST_VIEWER_MODES,
		type WishlistThemeId,
		type WishlistViewerMode,
	} from '$lib/theme/wishlist_themes.js';
	import WishlistAppearancePreviewPane from './WishlistAppearancePreviewPane.svelte';
	import {
		resolveWishlistThemeScope,
		type WishlistAppearancePreview,
	} from './wishlist_theme_scope.js';

	interface WishlistAppearanceModePreviewProps {
		/** The draft look, resolved the way the wishlist page resolves it. */
		appearance: WishlistAppearancePreview;
		palette: Palette;
		title: string;
		class?: string;
	}

	let {
		appearance,
		palette,
		title,
		class: className,
	}: WishlistAppearanceModePreviewProps = $props();

	const MODE_LABELS = {
		light: m.settings_mode_light,
		dark: m.settings_mode_dark,
	} satisfies Record<WishlistViewerMode, () => string>;

	const headingId = $props.id();
	const scope = $derived(resolveWishlistThemeScope(appearance));
	let loadedMotifs = $state.raw<{ themeId: WishlistThemeId; motifs: readonly string[] } | null>(
		null,
	);
	const motifs = $derived(
		loadedMotifs !== null && loadedMotifs.themeId === scope.backdropThemeId
			? loadedMotifs.motifs
			: [],
	);

	$effect(() => {
		const themeId = scope.backdropThemeId;
		if (themeId === null) {
			return;
		}
		let current = true;
		void loadWishlistThemeArt(themeId).then(
			(art) => {
				if (current) {
					loadedMotifs = { themeId, motifs: art.motifs };
				}
			},
			// Without art the preview still shows the motif backdrop pattern.
			() => {},
		);
		return () => {
			current = false;
		};
	});
</script>

<section
	class={['flex flex-col gap-3', className]}
	aria-labelledby={headingId}
	data-testid="wishlist-appearance-mode-preview"
>
	<div class="flex flex-col gap-1">
		<h3 id={headingId} class="text-base font-semibold">
			{m.wishlist_appearance_preview_heading()}
		</h3>
		<HelpText>{m.wishlist_appearance_preview_hint()}</HelpText>
	</div>
	<div class="grid grid-cols-2 gap-3">
		{#each WISHLIST_VIEWER_MODES as mode (mode)}
			<figure class="m-0 flex min-w-0 flex-col gap-1.5">
				<figcaption class="text-(length:--text-sm) font-semibold text-muted-foreground">
					{MODE_LABELS[mode]()}
				</figcaption>
				<WishlistAppearancePreviewPane {mode} {palette} {scope} {title} {motifs} />
			</figure>
		{/each}
	</div>
	<HelpText>{m.wishlist_appearance_preview_note()}</HelpText>
</section>
