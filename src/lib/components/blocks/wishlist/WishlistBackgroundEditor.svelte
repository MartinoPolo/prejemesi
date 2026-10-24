<script lang="ts">
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import { Slider } from '$lib/components/base/slider/index.js';
	import { toastError } from '$lib/components/base/toast/index.js';
	import ImageUpload from '$lib/components/derived/image-upload/ImageUpload.svelte';
	import type { UploadResult } from '$lib/modules/uploads/types.js';
	import {
		WISHLIST_BACKGROUND_DIM_MAX,
		type WishlistBackground,
		type WishlistBackgroundMode,
		type WishlistBackgroundMotion,
		type WishlistBackgroundPlacement,
		type WishlistThemeId,
	} from '$lib/theme/wishlist_themes.js';
	import {
		WISHLIST_LIBRARY_IMAGES,
		findWishlistLibraryImage,
		wishlistLibraryImageThumbnailUrl,
		wishlistLibraryImagesForTheme,
	} from '$lib/theme/wishlist_background_library.js';
	import WishlistAppearanceOptionRow from './WishlistAppearanceOptionRow.svelte';
	import WishlistBackgroundLibraryPicker from './WishlistBackgroundLibraryPicker.svelte';
	import WishlistBackgroundFocalPicker from './WishlistBackgroundFocalPicker.svelte';

	interface WishlistBackgroundEditorProps {
		background: WishlistBackground;
		/** Without a theme there is no theme backdrop to choose; its library images lead the picker. */
		themeId: WishlistThemeId | null;
		/** Display URL of the selected custom image (a local preview for a fresh upload). */
		imageUrl: string | null;
		/** Demo playgrounds never upload images. */
		allowCustomUpload: boolean;
		onchange: (changes: Partial<WishlistBackground>) => void;
		onupload: (result: UploadResult, uploadedFile: File) => void;
		onremove: () => void;
		disabled?: boolean;
	}

	let {
		background,
		themeId,
		imageUrl,
		allowCustomUpload,
		onchange,
		onupload,
		onremove,
		disabled = false,
	}: WishlistBackgroundEditorProps = $props();

	const idPrefix = $props.id();

	const modeOptions = $derived([
		{
			value: 'theme',
			label: m.wishlist_appearance_background_theme(),
			disabled: themeId === null,
		},
		// Hidden until the offline generator has filled the library.
		...(WISHLIST_LIBRARY_IMAGES.length === 0
			? []
			: [{ value: 'library' as const, label: m.wishlist_appearance_background_library() }]),
		{
			value: 'custom',
			label: m.wishlist_appearance_background_custom(),
			disabled: !allowCustomUpload,
		},
		{ value: 'none', label: m.wishlist_appearance_background_none() },
	] satisfies { value: WishlistBackgroundMode; label: string; disabled?: boolean }[]);
	const placementOptions = [
		{ value: 'gutters', label: m.wishlist_appearance_background_placement_gutters() },
		{ value: 'full', label: m.wishlist_appearance_background_placement_full() },
	] satisfies { value: WishlistBackgroundPlacement; label: string }[];
	const motionOptions = [
		{ value: 'subtle', label: m.wishlist_appearance_motion_subtle() },
		{ value: 'off', label: m.wishlist_appearance_motion_off() },
	] satisfies { value: WishlistBackgroundMotion; label: string }[];

	const showsCustomControls = $derived(background.mode === 'custom' && allowCustomUpload);
	const customImageUrl = $derived(background.imageKey === null ? null : imageUrl);
	const selectedLibraryImage = $derived(
		background.mode === 'library' ? findWishlistLibraryImage(background.libraryImageId) : null,
	);

	/** Library mode always shows an image: the first one (the list theme's) until one is picked. */
	function selectMode(mode: WishlistBackgroundMode) {
		if (mode === 'library' && findWishlistLibraryImage(background.libraryImageId) === null) {
			const [firstLibraryImage] = wishlistLibraryImagesForTheme(themeId);
			onchange({ mode, libraryImageId: firstLibraryImage?.id ?? null });
			return;
		}
		onchange({ mode });
	}

	function handleUploadError(uploadError: Error, message: string) {
		console.error('Wishlist background upload failed:', uploadError.message);
		toastError(m.wishlist_appearance_background_upload_error(), message);
	}
</script>

{#snippet photoControls(photoUrl: string, replaceable: boolean)}
	<div class="flex flex-col gap-2">
		<div class="flex flex-wrap items-center justify-between gap-2">
			<Label id="{idPrefix}-focal-label">
				{m.wishlist_appearance_background_focal_label()}
			</Label>
			{#if replaceable}
				<div class="flex flex-wrap gap-(--nested-control-gap)">
					<ImageUpload
						target="wishlist-background"
						size="compact"
						label={m.wishlist_appearance_background_change()}
						{disabled}
						onUpload={onupload}
						onError={handleUploadError}
					/>
					<Button type="button" intent="danger" {disabled} onclick={onremove}>
						<TrashIcon data-icon="inline-start" />
						{m.wishlist_appearance_background_remove()}
					</Button>
				</div>
			{/if}
		</div>
		<WishlistBackgroundFocalPicker
			imageUrl={photoUrl}
			focal={background.focal}
			onchange={(focal) => onchange({ focal })}
			describedBy="{idPrefix}-focal-hint"
			{disabled}
		/>
		<HelpText id="{idPrefix}-focal-hint">
			{m.wishlist_appearance_background_focal_hint()}
		</HelpText>
	</div>
	<WishlistAppearanceOptionRow
		id="wishlist-appearance-placement"
		label={m.wishlist_appearance_background_placement_label()}
		value={background.placement}
		options={placementOptions}
		onchange={(placement) => onchange({ placement })}
		{disabled}
	/>
	<div
		class="flex flex-col gap-2 sm:grid sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center sm:gap-3"
	>
		<Label id="wishlist-appearance-dim-label" for="wishlist-appearance-dim">
			{m.wishlist_appearance_background_dim_label()}
		</Label>
		<div class="flex min-w-0 flex-col gap-1.5">
			<div class="flex items-center gap-3">
				<Slider
					id="wishlist-appearance-dim"
					value={background.dim}
					min={0}
					max={WISHLIST_BACKGROUND_DIM_MAX}
					{disabled}
					aria-describedby="wishlist-appearance-dim-hint"
					onValueChange={(dim) => onchange({ dim })}
				/>
				<span class="w-12 shrink-0 text-right text-sm tabular-nums">
					{m.wishlist_appearance_background_dim_value({
						dim: String(background.dim),
					})}
				</span>
			</div>
			<HelpText id="wishlist-appearance-dim-hint">
				{m.wishlist_appearance_background_dim_hint()}
			</HelpText>
		</div>
	</div>
{/snippet}

<div class="flex flex-col gap-4">
	<WishlistAppearanceOptionRow
		id="wishlist-appearance-background"
		label={m.wishlist_appearance_background_label()}
		value={background.mode}
		options={modeOptions}
		onchange={selectMode}
		{disabled}
	>
		{#snippet help()}
			{#if !allowCustomUpload}
				<HelpText>{m.demo_image_limits()}</HelpText>
			{/if}
		{/snippet}
	</WishlistAppearanceOptionRow>

	{#if showsCustomControls}
		{#if customImageUrl === null}
			<div class="flex flex-col gap-2">
				<ImageUpload
					target="wishlist-background"
					label={m.wishlist_appearance_background_upload_label()}
					{disabled}
					onUpload={onupload}
					onError={handleUploadError}
				/>
				<HelpText>{m.wishlist_appearance_background_upload_hint()}</HelpText>
			</div>
		{:else}
			{@render photoControls(customImageUrl, true)}
		{/if}
	{:else if selectedLibraryImage !== null}
		<div class="flex flex-col gap-2">
			<Label id="{idPrefix}-library-label">
				{m.wishlist_appearance_background_library_label()}
			</Label>
			<WishlistBackgroundLibraryPicker
				value={selectedLibraryImage.id}
				{themeId}
				onchange={(libraryImageId) => onchange({ libraryImageId })}
				labelledBy="{idPrefix}-library-label"
				{disabled}
			/>
		</div>
		{@render photoControls(wishlistLibraryImageThumbnailUrl(selectedLibraryImage), false)}
	{/if}

	{#if background.mode !== 'none'}
		<WishlistAppearanceOptionRow
			id="wishlist-appearance-motion"
			label={m.wishlist_appearance_motion_label()}
			value={background.motion}
			options={motionOptions}
			onchange={(motion) => onchange({ motion })}
			{disabled}
		>
			{#snippet help()}
				<HelpText>{m.wishlist_appearance_motion_hint()}</HelpText>
			{/snippet}
		</WishlistAppearanceOptionRow>
	{/if}
</div>
