<script lang="ts">
	import { untrack } from 'svelte';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import * as m from '$lib/paraglide/messages.js';
	import * as Accordion from '$lib/components/base/accordion/index.js';
	import { Badge } from '$lib/components/base/badge/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import { imagePublicUrl } from '$lib/modules/images/public_url.js';
	import { createPendingUploads } from '$lib/modules/uploads/upload.js';
	import type { UploadResult } from '$lib/modules/uploads/types.js';
	import type { WishlistAppearance } from '$lib/modules/wishlists/wishlist_appearance.js';
	import type { Palette } from '$lib/theme/palettes.js';
	import type {
		WishlistHeroFrame,
		WishlistStyleTokens,
		WishlistThemeId,
	} from '$lib/theme/wishlist_themes.js';
	import WishlistAppearanceModePreview from './WishlistAppearanceModePreview.svelte';
	import WishlistAppearanceOptionRow from './WishlistAppearanceOptionRow.svelte';
	import WishlistBackgroundEditor from './WishlistBackgroundEditor.svelte';
	import WishlistPalettePicker from './WishlistPalettePicker.svelte';
	import WishlistStyleTokenEditor from './WishlistStyleTokenEditor.svelte';
	import WishlistThemeGallery from './WishlistThemeGallery.svelte';
	import {
		WISHLIST_MOTIF_FIELDS,
		createWishlistAppearanceDraft,
		draftStyle,
		isMotifFieldOverridden,
		isSameWishlistAppearanceDraft,
		resetMotifField,
		selectWishlistTheme,
		setWishlistBackground,
		setWishlistStyleToken,
		wishlistAppearanceDraftToInput,
		wishlistAppearanceDraftToPreview,
		type WishlistAppearanceDraft,
		type WishlistAppearanceEditorDraft,
		type WishlistMotifField,
	} from './wishlist_appearance_draft.js';
	import type { WishlistAppearancePreview } from './wishlist_theme_scope.js';

	interface WishlistAppearanceEditorProps {
		/** Saved palette and appearance; the editor seeds its draft from them once per mount. */
		palette: Palette;
		appearance: WishlistAppearance;
		/** Shown as the hero title in the light and dark preview. */
		title: string;
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

	/** Accordion item value of the "Přizpůsobit motiv" disclosure. */
	const CUSTOMIZE_SECTION = 'customize';
	const HERO_FRAME_OPTIONS = [
		{ value: 'notebook', label: m.wishlist_appearance_hero_frame_notebook() },
		{ value: 'gift', label: m.wishlist_appearance_hero_frame_gift() },
		{ value: 'tag', label: m.wishlist_appearance_hero_frame_tag() },
		{ value: 'invitation', label: m.wishlist_appearance_hero_frame_invitation() },
	] satisfies { value: WishlistHeroFrame; label: string }[];
	const FIELD_HEADINGS = {
		palette: m.wishlist_appearance_palette_heading,
		background: m.wishlist_appearance_background_heading,
		heroFrame: m.wishlist_appearance_hero_frame_heading,
		style: m.wishlist_appearance_style_heading,
	} satisfies Record<WishlistMotifField, () => string>;

	let {
		palette,
		appearance,
		title,
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
	// A list without a motif, or one already customized, opens with its customizations in view.
	let openSection = $state(
		untrack(() =>
			draft.themeId === null ||
			WISHLIST_MOTIF_FIELDS.some((field) =>
				isMotifFieldOverridden(draft, paletteDraft, field),
			)
				? CUSTOMIZE_SECTION
				: '',
		),
	);

	const idPrefix = $props.id();
	const pendingUploads = createPendingUploads();

	const appearanceDirty = $derived(!isSameWishlistAppearanceDraft(draft, savedDraft));
	const paletteDirty = $derived(paletteDraft !== savedPalette);
	const freshUploadSelected = $derived(
		freshUpload !== null && freshUpload.objectKey === draft.background.imageKey,
	);
	const freshPreviewUrl = $derived(freshUploadSelected ? freshUpload?.previewUrl : undefined);
	const backgroundImageUrl = $derived.by(() => {
		if (freshPreviewUrl !== undefined) {
			return freshPreviewUrl;
		}
		const { imageKey } = draft.background;
		return imageKey === null ? null : imagePublicUrl(imageKey);
	});
	const style = $derived(draftStyle(draft));
	const draftPreview = $derived(wishlistAppearanceDraftToPreview(draft, freshPreviewUrl));

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

	function resetField(field: WishlistMotifField) {
		const reset = resetMotifField(draft, field);
		draft = reset.draft;
		if (reset.palette !== null) {
			selectPalette(reset.palette);
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
		const preview = draftPreview;
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

<!-- A customizable part of the motif: its heading says whether the motif still supplies it or
     offers to hand it back to the motif. Without a motif there is nothing to hand back to. -->
{#snippet motifFieldHeading(field: WishlistMotifField)}
	{@const heading = FIELD_HEADINGS[field]()}
	<div class="flex min-h-(--size-control-sm) flex-wrap items-center gap-x-3 gap-y-1">
		<h4 id="{idPrefix}-{field}-heading" class="text-(length:--text-md) font-semibold">
			{heading}
		</h4>
		{#if draft.themeId !== null}
			{#if isMotifFieldOverridden(draft, paletteDraft, field)}
				<Button
					type="button"
					size="sm"
					intent="ghost"
					aria-label={m.wishlist_appearance_reset_field_to_theme({ field: heading })}
					{disabled}
					onclick={() => resetField(field)}
				>
					<RotateCcwIcon data-icon="inline-start" />
					{m.wishlist_appearance_reset_to_theme()}
				</Button>
			{:else}
				<Badge tone="primary" badgeStyle="subtle" data-testid="wishlist-motif-field-marker">
					{m.wishlist_appearance_from_theme()}
				</Badge>
			{/if}
		{/if}
	</div>
{/snippet}

<div
	class="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:grid-rows-[auto_1fr] lg:gap-x-8"
	data-testid="wishlist-appearance-editor"
>
	<section
		class="flex flex-col gap-3 lg:col-start-1 lg:row-start-1"
		aria-labelledby="{idPrefix}-theme-heading"
	>
		<div class="flex flex-col gap-1">
			<h3 id="{idPrefix}-theme-heading" class="text-base font-semibold">
				{m.wishlist_appearance_theme_heading()}
			</h3>
			<HelpText>{m.wishlist_appearance_theme_hint()}</HelpText>
		</div>
		<WishlistThemeGallery
			value={draft.themeId}
			onchange={selectTheme}
			palette={paletteDraft}
			labelledBy="{idPrefix}-theme-heading"
			{disabled}
		/>
	</section>

	<WishlistAppearanceModePreview
		class="lg:sticky lg:top-0 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start"
		appearance={draftPreview}
		palette={paletteDraft}
		{title}
	/>

	<!-- The negative margin and matching padding keep focus rings and control shadows inside the
	     disclosure's clipping box while the content stays aligned with the motif grid. -->
	<Accordion.Root
		type="single"
		bind:value={openSection}
		class="-mx-1.5 border-t-2 border-dashed border-ink-faint lg:col-start-1 lg:row-start-2"
	>
		<Accordion.Item value={CUSTOMIZE_SECTION} class="border-b-0">
			<Accordion.Trigger class="px-1.5 py-3 text-base hover:no-underline">
				{m.wishlist_appearance_customize()}
			</Accordion.Trigger>
			<Accordion.Content
				class="flex flex-col gap-6 px-1.5 pt-1 pb-2 text-base [&_p:not(:last-child)]:mb-0"
			>
				<section class="flex flex-col gap-2" aria-labelledby="{idPrefix}-palette-heading">
					{@render motifFieldHeading('palette')}
					<HelpText>{m.wishlist_appearance_palette_hint()}</HelpText>
					<WishlistPalettePicker
						class="mx-0 justify-start"
						value={paletteDraft}
						onchange={selectPalette}
						{disabled}
					/>
				</section>

				<section
					class="flex flex-col gap-2"
					aria-labelledby="{idPrefix}-background-heading"
				>
					{@render motifFieldHeading('background')}
					<WishlistBackgroundEditor
						labelledBy="{idPrefix}-background-heading"
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

				<section class="flex flex-col gap-2" aria-labelledby="{idPrefix}-heroFrame-heading">
					{@render motifFieldHeading('heroFrame')}
					<WishlistAppearanceOptionRow
						id="wishlist-appearance-hero-frame"
						labelledBy="{idPrefix}-heroFrame-heading"
						value={style.heroFrame}
						options={HERO_FRAME_OPTIONS}
						onchange={(heroFrame) => changeStyleToken('heroFrame', heroFrame)}
						{disabled}
					/>
				</section>

				<section class="flex flex-col gap-2" aria-labelledby="{idPrefix}-style-heading">
					{@render motifFieldHeading('style')}
					<WishlistStyleTokenEditor {style} onchange={changeStyleToken} {disabled} />
				</section>
			</Accordion.Content>
		</Accordion.Item>
	</Accordion.Root>
</div>
