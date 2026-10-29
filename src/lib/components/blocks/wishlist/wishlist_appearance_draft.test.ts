import { describe, expect, it } from 'vitest';
import { DEFAULT_WISHLIST_BACKGROUND, WISHLIST_THEMES } from '$lib/theme/wishlist_themes.js';
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
		expect(hasStyleOverrides(overridden)).toBe(true);

		const restored = setWishlistStyleToken(
			overridden,
			'corners',
			WISHLIST_THEMES.minimal.style.corners,
		);
		expect(restored.styleOverrides).toEqual({});
		expect(hasStyleOverrides(restored)).toBe(false);
	});

	it('resetting the style returns to the theme defaults', () => {
		const themed = selectWishlistTheme(unthemed, 'wedding').draft;
		const overridden = setWishlistStyleToken(themed, 'heading', 'hand');
		const reset = resetWishlistStyleOverrides(overridden);
		expect(draftStyle(reset)).toEqual(WISHLIST_THEMES.wedding.style);
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
		['motion', { motion: 'off' }],
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
