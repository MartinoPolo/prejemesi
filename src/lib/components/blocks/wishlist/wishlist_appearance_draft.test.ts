import { describe, expect, it } from 'vitest';
import { DEFAULT_WISHLIST_BACKGROUND, WISHLIST_THEMES } from '$lib/theme/wishlist_themes.js';
import {
	createWishlistAppearanceDraft,
	draftStyle,
	isMotifFieldOverridden,
	isSameWishlistAppearanceDraft,
	resetMotifField,
	selectWishlistTheme,
	WISHLIST_MOTIF_FIELDS,
	setWishlistBackground,
	setWishlistStyleToken,
	wishlistAppearanceDraftToInput,
	wishlistAppearanceDraftToPreview,
} from './wishlist_appearance_draft.js';

const unthemed = createWishlistAppearanceDraft({
	themeId: null,
	styleTokens: null,
	background: null,
});

describe('wishlist appearance draft', () => {
	it('seeds an unset background with the defaults and keeps stored overrides', () => {
		const draft = createWishlistAppearanceDraft({
			themeId: 'minimal',
			styleTokens: { corners: 'round' },
			background: { dim: 40 },
		});
		expect(draft.background).toEqual({ ...DEFAULT_WISHLIST_BACKGROUND, dim: 40 });
		expect(draftStyle(draft)).toEqual({ ...WISHLIST_THEMES.minimal.style, corners: 'round' });
	});

	it('choosing a theme copies its palette, drops overrides and shows its backdrop', () => {
		const customized = setWishlistStyleToken(
			setWishlistBackground(unthemed, { mode: 'none' }),
			'corners',
			'sharp',
		);
		const { draft, palette } = selectWishlistTheme(customized, 'christmas');
		expect(palette).toBe(WISHLIST_THEMES.christmas.palette);
		expect(draft.themeId).toBe('christmas');
		expect(draft.styleOverrides).toEqual({});
		expect(draft.background.mode).toBe('theme');
	});

	it('keeps a selected custom photo when switching themes', () => {
		const withPhoto = setWishlistBackground(unthemed, {
			mode: 'custom',
			imageKey: 'wishlists/backgrounds/photo.jpg',
		});
		const { draft } = selectWishlistTheme(withPhoto, 'gamer');
		expect(draft.background.mode).toBe('custom');
		expect(draft.background.imageKey).toBe('wishlists/backgrounds/photo.jpg');
	});

	it('keeps a selected library image when switching themes', () => {
		const withLibraryImage = setWishlistBackground(unthemed, {
			mode: 'library',
			libraryImageId: 'christmas-photo',
		});
		const { draft } = selectWishlistTheme(withLibraryImage, 'gamer');
		expect(draft.background.mode).toBe('library');
		expect(draft.background.libraryImageId).toBe('christmas-photo');
	});

	it('keeps a stored custom upload while a library image is selected', () => {
		const saved = createWishlistAppearanceDraft({
			themeId: null,
			styleTokens: null,
			background: { mode: 'custom', imageKey: 'stored.jpg' },
		});
		const input = wishlistAppearanceDraftToInput(
			setWishlistBackground(saved, { mode: 'library', libraryImageId: 'christmas-photo' }),
			'stored.jpg',
		);
		expect(input.background).not.toHaveProperty('imageKey');
		expect(input.background).toMatchObject({
			mode: 'library',
			libraryImageId: 'christmas-photo',
		});
	});

	it('choosing no theme keeps the palette and shows no theme backdrop', () => {
		const themed = selectWishlistTheme(unthemed, 'toys').draft;
		const { draft, palette } = selectWishlistTheme(themed, null);
		expect(palette).toBeNull();
		expect(draft.themeId).toBeNull();
		expect(draft.background.mode).toBe('none');
	});

	it('stores a style token only while it differs from the theme default', () => {
		const themed = selectWishlistTheme(unthemed, 'minimal').draft;
		const overridden = setWishlistStyleToken(themed, 'corners', 'round');
		expect(overridden.styleOverrides).toEqual({ corners: 'round' });

		const restored = setWishlistStyleToken(
			overridden,
			'corners',
			WISHLIST_THEMES.minimal.style.corners,
		);
		expect(restored.styleOverrides).toEqual({});
	});

	it('stores a chosen hero frame as an override of the motif frame', () => {
		const christmas = selectWishlistTheme(unthemed, 'christmas').draft;
		expect(draftStyle(christmas).heroFrame).toBe(WISHLIST_THEMES.christmas.style.heroFrame);
		const tagged = setWishlistStyleToken(christmas, 'heroFrame', 'tag');
		expect(tagged.styleOverrides).toEqual({ heroFrame: 'tag' });
		expect(wishlistAppearanceDraftToInput(tagged, null).styleTokens).toEqual({
			heroFrame: 'tag',
		});
	});

	describe('motif fields', () => {
		const christmas = selectWishlistTheme(unthemed, 'christmas').draft;
		const christmasPalette = WISHLIST_THEMES.christmas.palette;

		function overriddenFields(draft: typeof christmas, palette = christmasPalette) {
			return WISHLIST_MOTIF_FIELDS.filter((field) =>
				isMotifFieldOverridden(draft, palette, field),
			);
		}

		it('all come from a freshly chosen motif', () => {
			expect(overriddenFields(christmas)).toEqual([]);
		});

		it('count a palette other than the motif palette as an override', () => {
			expect(overriddenFields(christmas, 'ocean')).toEqual(['palette']);
		});

		it.each(['library', 'custom', 'none'] as const)(
			'count a %s background as an override',
			(mode) => {
				expect(overriddenFields(setWishlistBackground(christmas, { mode }))).toEqual([
					'background',
				]);
			},
		);

		it('keep photo settings of the motif backdrop as the motif background', () => {
			expect(overriddenFields(setWishlistBackground(christmas, { dim: 45 }))).toEqual([]);
		});

		it('separate the hero frame from the other style tokens', () => {
			expect(overriddenFields(setWishlistStyleToken(christmas, 'heroFrame', 'tag'))).toEqual([
				'heroFrame',
			]);
			for (const [token, value] of [
				['corners', 'sharp'],
				['border', 'fine'],
				['mat', 'black'],
				['heading', 'elegant'],
			] as const) {
				expect(overriddenFields(setWishlistStyleToken(christmas, token, value))).toEqual([
					'style',
				]);
			}
		});

		it('are never overridden without a motif, so there is nothing to reset to', () => {
			const customized = setWishlistStyleToken(
				setWishlistBackground(unthemed, { mode: 'none' }),
				'corners',
				'sharp',
			);
			expect(overriddenFields(customized, 'ruby')).toEqual([]);
			expect(resetMotifField(customized, 'style')).toEqual({
				draft: customized,
				palette: null,
			});
		});

		it('reset the palette to the motif palette', () => {
			expect(resetMotifField(christmas, 'palette')).toEqual({
				draft: christmas,
				palette: christmasPalette,
			});
		});

		it('reset the background to the motif backdrop and keep the stored upload', () => {
			const withPhoto = setWishlistBackground(christmas, {
				mode: 'custom',
				imageKey: 'wishlists/backgrounds/photo.jpg',
			});
			const { draft, palette } = resetMotifField(withPhoto, 'background');
			expect(palette).toBeNull();
			expect(draft.background).toEqual({ ...withPhoto.background, mode: 'theme' });
			expect(overriddenFields(draft)).toEqual([]);
		});

		it('reset the hero frame and the style apart from each other', () => {
			const customized = setWishlistStyleToken(
				setWishlistStyleToken(
					setWishlistStyleToken(christmas, 'heroFrame', 'invitation'),
					'corners',
					'sharp',
				),
				'heading',
				'hand',
			);
			const frameReset = resetMotifField(customized, 'heroFrame').draft;
			expect(frameReset.styleOverrides).toEqual({ corners: 'sharp', heading: 'hand' });
			const styleReset = resetMotifField(customized, 'style').draft;
			expect(styleReset.styleOverrides).toEqual({ heroFrame: 'invitation' });
			expect(draftStyle(resetMotifField(frameReset, 'style').draft)).toEqual(
				WISHLIST_THEMES.christmas.style,
			);
		});

		it('show a stored row exactly as stored and save it back unchanged', () => {
			const stored = {
				themeId: 'minimal',
				// A stored override equal to the motif default stays an explicit choice.
				styleTokens: { corners: 'sharp', heroFrame: 'gift' },
				background: {
					mode: 'library',
					libraryImageId: 'christmas-photo',
					imageKey: 'wishlists/backgrounds/kept.jpg',
					focal: { x: 20, y: 70 },
					placement: 'full',
					dim: 35,
				},
			} as const;
			const draft = createWishlistAppearanceDraft(stored);
			expect(overriddenFields(draft, 'ocean')).toEqual([
				'palette',
				'background',
				'heroFrame',
				'style',
			]);
			expect(draftStyle(draft)).toEqual({
				...WISHLIST_THEMES.minimal.style,
				corners: 'sharp',
				heroFrame: 'gift',
			});
			expect(
				isSameWishlistAppearanceDraft(draft, createWishlistAppearanceDraft(stored)),
			).toBe(true);

			const input = wishlistAppearanceDraftToInput(draft, stored.background.imageKey);
			expect(input).toEqual({
				themeId: stored.themeId,
				styleTokens: stored.styleTokens,
				background: {
					mode: stored.background.mode,
					libraryImageId: stored.background.libraryImageId,
					focal: stored.background.focal,
					placement: stored.background.placement,
					dim: stored.background.dim,
				},
			});
		});
	});

	it('detects a change and its revert as clean again', () => {
		const changed = setWishlistBackground(unthemed, { dim: 45 });
		expect(isSameWishlistAppearanceDraft(changed, unthemed)).toBe(false);
		const reverted = setWishlistBackground(changed, { dim: DEFAULT_WISHLIST_BACKGROUND.dim });
		expect(isSameWishlistAppearanceDraft(reverted, unthemed)).toBe(true);
		const moved = setWishlistBackground(unthemed, { focal: { x: 50, y: 20 } });
		expect(isSameWishlistAppearanceDraft(moved, unthemed)).toBe(false);
	});

	it.each([
		['mode', { mode: 'none' }],
		['image key', { imageKey: 'wishlists/backgrounds/photo.webp' }],
		['library image', { libraryImageId: 'christmas-photo' }],
		['focal point', { focal: { x: 10, y: 50 } }],
		['placement', { placement: 'full' }],
		['dim', { dim: 0 }],
	] as const)('counts a changed background %s as a change', (_field, changes) => {
		expect(
			isSameWishlistAppearanceDraft(setWishlistBackground(unthemed, changes), unthemed),
		).toBe(false);
	});

	it('treats an equal focal point copy as unchanged', () => {
		const copied = setWishlistBackground(unthemed, { focal: { ...unthemed.background.focal } });
		expect(isSameWishlistAppearanceDraft(copied, unthemed)).toBe(true);
	});

	it('omits an unchanged image key so the stored upload is kept', () => {
		const saved = createWishlistAppearanceDraft({
			themeId: null,
			styleTokens: null,
			background: { mode: 'custom', imageKey: 'stored.jpg' },
		});
		const input = wishlistAppearanceDraftToInput(
			setWishlistBackground(saved, { dim: 30 }),
			'stored.jpg',
		);
		expect(input.background).not.toHaveProperty('imageKey');
		expect(input.background?.dim).toBe(30);
		expect(input).not.toHaveProperty('backgroundAssignmentToken');
	});

	it('sends null for a removed image and the proof for a new upload', () => {
		const saved = createWishlistAppearanceDraft({
			themeId: null,
			styleTokens: null,
			background: { mode: 'custom', imageKey: 'stored.jpg' },
		});
		const removed = wishlistAppearanceDraftToInput(
			setWishlistBackground(saved, { imageKey: null, mode: 'none' }),
			'stored.jpg',
		);
		expect(removed.background?.imageKey).toBeNull();

		const replaced = wishlistAppearanceDraftToInput(
			setWishlistBackground(saved, { imageKey: 'fresh.jpg' }),
			'stored.jpg',
			'proof',
		);
		expect(replaced.background?.imageKey).toBe('fresh.jpg');
		expect(replaced.backgroundAssignmentToken).toBe('proof');
	});

	it('sends no style overrides as null', () => {
		const input = wishlistAppearanceDraftToInput(
			selectWishlistTheme(unthemed, 'books').draft,
			null,
		);
		expect(input.themeId).toBe('books');
		expect(input.styleTokens).toBeNull();
	});

	it('previews a local photo URL alongside the draft', () => {
		const draft = setWishlistBackground(unthemed, { mode: 'custom', imageKey: 'fresh.jpg' });
		expect(wishlistAppearanceDraftToPreview(draft, 'blob:photo')).toMatchObject({
			previewImageUrl: 'blob:photo',
			background: { mode: 'custom', imageKey: 'fresh.jpg' },
		});
		expect(wishlistAppearanceDraftToPreview(draft)).not.toHaveProperty('previewImageUrl');
	});
});
