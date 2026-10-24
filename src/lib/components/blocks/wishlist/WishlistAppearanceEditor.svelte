<script lang="ts">
	import { untrack } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import { Separator } from '$lib/components/base/separator/index.js';
	import { imagePublicUrl } from '$lib/modules/images/public_url.js';
	import { createPendingUploads } from '$lib/modules/uploads/upload.js';
	import type { UploadResult } from '$lib/modules/uploads/types.js';
	import type { WishlistAppearance } from '$lib/modules/wishlists/wishlist_appearance.js';
	import type { Palette } from '$lib/theme/palettes.js';
	import type { WishlistStyleTokens, WishlistThemeId } from '$lib/theme/wishlist_themes.js';
	import WishlistBackgroundEditor from './WishlistBackgroundEditor.svelte';
	import WishlistPalettePicker from './WishlistPalettePicker.svelte';
	import WishlistStyleTokenEditor from './WishlistStyleTokenEditor.svelte';
	import WishlistThemeGallery from './WishlistThemeGallery.svelte';
	import {
		createWishlistAppearanceDraft,
		draftStyle,
		hasStyleOverrides,
		isSameWishlistAppearanceDraft,
		resetWishlistStyleOverrides,
		selectWishlistTheme,
		setWishlistBackground,
		setWishlistStyleToken,
		wishlistAppearanceDraftToInput,
		wishlistAppearanceDraftToPreview,
		type WishlistAppearanceDraft,
		type WishlistAppearanceEditorDraft,
	} from './wishlist_appearance_draft.js';
	import type { WishlistAppearancePreview } from './wishlist_theme_scope.js';

	interface WishlistAppearanceEditorProps {
		/** Saved palette and appearance; the editor seeds its draft from them once per mount. */
		palette: Palette;
		appearance: WishlistAppearance;
		/** Demo playgrounds never upload images. */
		allowCustomUpload: boolean;
		/** Bumped after a successful save: the current draft becomes the saved baseline. */
		commitVersion?: number;
		disabled?: boolean;
		ondraftchange: (draft: WishlistAppearanceEditorDraft) => void;
		/** Palette preview on the page behind the dialog. */
		onpaletteselect?: (palette: Palette) => void;
		/** Appearance preview on the page behind the dialog; null once nothing differs. */
		onappearancepreview?: (appearance: WishlistAppearancePreview | null) => void;
	}

	/** A background uploaded in this session; its local preview shows before the CDN copy loads. */
	interface FreshBackgroundUpload {
		objectKey: string;
		assignmentToken: string;
		previewUrl: string;
	}

	let {
		palette,
		appearance,
		allowCustomUpload,
		commitVersion = 0,
		disabled = false,
		ondraftchange,
		onpaletteselect,
		onappearancepreview,
	}: WishlistAppearanceEditorProps = $props();

	// svelte-ignore state_referenced_locally (one-time draft seed; the modal remounts on discard)
	let paletteDraft = $state<Palette>(palette);
	// svelte-ignore state_referenced_locally (one-time saved baseline)
	let savedPalette = $state<Palette>(palette);
	// svelte-ignore state_referenced_locally (one-time draft seed; the modal remounts on discard)
	let draft = $state.raw<WishlistAppearanceDraft>(createWishlistAppearanceDraft(appearance));
	let savedDraft = $state.raw<WishlistAppearanceDraft>(untrack(() => draft));
	let freshUpload = $state.raw<FreshBackgroundUpload | null>(null);
	// svelte-ignore state_referenced_locally (one-time version seed)
	let seenCommitVersion = $state(commitVersion);

	const pendingUploads = createPendingUploads();

	const appearanceDirty = $derived(!isSameWishlistAppearanceDraft(draft, savedDraft));
	const paletteDirty = $derived(paletteDraft !== savedPalette);
	const freshUploadSelected = $derived(
		freshUpload !== null && freshUpload.objectKey === draft.background.imageKey,
	);
	const backgroundImageUrl = $derived.by(() => {
		if (freshUploadSelected && freshUpload !== null) {
			return freshUpload.previewUrl;
		}
		const { imageKey } = draft.background;
		return imageKey === null ? null : imagePublicUrl(imageKey);
	});

	function selectPalette(nextPalette: Palette) {
		if (nextPalette === paletteDraft) {
			return;
		}
		paletteDraft = nextPalette;
		onpaletteselect?.(nextPalette);
	}

	function selectTheme(themeId: WishlistThemeId | null) {
		const selection = selectWishlistTheme(draft, themeId);
		draft = selection.draft;
		if (selection.palette !== null) {
			selectPalette(selection.palette);
		}
	}

	function changeStyleToken<Token extends keyof WishlistStyleTokens>(
		token: Token,
		value: WishlistStyleTokens[Token],
	) {
		draft = setWishlistStyleToken(draft, token, value);
	}

	function releaseFreshUploadPreview() {
		if (freshUpload !== null) {
			URL.revokeObjectURL(freshUpload.previewUrl);
			freshUpload = null;
		}
	}

	function handleUpload(result: UploadResult, uploadedFile: File) {
		pendingUploads.track(result);
		releaseFreshUploadPreview();
		freshUpload = {
			objectKey: result.objectKey,
			assignmentToken: result.deleteToken,
			previewUrl: URL.createObjectURL(uploadedFile),
		};
		draft = setWishlistBackground(draft, { mode: 'custom', imageKey: result.objectKey });
	}

	function handleRemoveImage() {
		releaseFreshUploadPreview();
		draft = setWishlistBackground(draft, { imageKey: null });
	}

	$effect(() => {
		ondraftchange({
			paletteDirty,
			palette: paletteDraft,
			appearanceDirty,
			appearance: wishlistAppearanceDraftToInput(
				draft,
				savedDraft.background.imageKey,
				freshUploadSelected ? freshUpload?.assignmentToken : undefined,
			),
		});
	});

	// Follows draft edits only: a save keeps the preview until the modal drops it after the page
	// has refreshed, so the page never flashes the pre-save look.
	$effect(() => {
		const preview = wishlistAppearanceDraftToPreview(
			draft,
			freshUploadSelected ? freshUpload?.previewUrl : undefined,
		);
		const matchesSaved = untrack(() => isSameWishlistAppearanceDraft(draft, savedDraft));
		onappearancepreview?.(matchesSaved ? null : preview);
	});

	$effect(() => {
		if (commitVersion === seenCommitVersion) {
			return;
		}
		seenCommitVersion = commitVersion;
		untrack(() => {
			savedDraft = draft;
			savedPalette = paletteDraft;
			// Uploads replaced before this save are deleted; the saved key survives.
			void pendingUploads.commit(draft.background.imageKey);
		});
	});

	$effect(() => {
		return () => {
			untrack(() => {
				onappearancepreview?.(null);
				releaseFreshUploadPreview();
			});
			void pendingUploads.discardAll();
		};
	});
</script>

<div class="flex flex-col gap-6" data-testid="wishlist-appearance-editor">
	<HelpText>{m.wishlist_appearance_preview_note()}</HelpText>

	<section class="flex flex-col gap-3" aria-labelledby="wishlist-appearance-theme-heading">
		<div class="flex flex-col gap-1">
			<h3 id="wishlist-appearance-theme-heading" class="text-base font-semibold">
				{m.wishlist_appearance_theme_heading()}
			</h3>
			<HelpText>{m.wishlist_appearance_theme_hint()}</HelpText>
		</div>
		<WishlistThemeGallery
			value={draft.themeId}
			onchange={selectTheme}
			palette={paletteDraft}
			labelledBy="wishlist-appearance-theme-heading"
			{disabled}
		/>
	</section>

	<Separator />

	<section class="flex flex-col gap-3" aria-labelledby="wishlist-appearance-palette-heading">
		<div class="flex flex-col gap-1">
			<h3 id="wishlist-appearance-palette-heading" class="text-base font-semibold">
				{m.wishlist_appearance_palette_heading()}
			</h3>
			<HelpText>{m.wishlist_appearance_palette_hint()}</HelpText>
		</div>
		<WishlistPalettePicker value={paletteDraft} onchange={selectPalette} {disabled} />
	</section>

	<Separator />

	<section class="flex flex-col gap-3" aria-labelledby="wishlist-appearance-background-heading">
		<h3 id="wishlist-appearance-background-heading" class="text-base font-semibold">
			{m.wishlist_appearance_background_heading()}
		</h3>
		<WishlistBackgroundEditor
			background={draft.background}
			themeId={draft.themeId}
			imageUrl={backgroundImageUrl}
			{allowCustomUpload}
			onchange={(changes) => (draft = setWishlistBackground(draft, changes))}
			onupload={handleUpload}
			onremove={handleRemoveImage}
			{disabled}
		/>
	</section>

	<Separator />

	<section class="flex flex-col gap-3" aria-labelledby="wishlist-appearance-style-heading">
		<h3 id="wishlist-appearance-style-heading" class="text-base font-semibold">
			{m.wishlist_appearance_style_heading()}
		</h3>
		<WishlistStyleTokenEditor
			style={draftStyle(draft)}
			hasOverrides={hasStyleOverrides(draft)}
			onchange={changeStyleToken}
			onreset={() => (draft = resetWishlistStyleOverrides(draft))}
			{disabled}
		/>
	</section>
</div>
