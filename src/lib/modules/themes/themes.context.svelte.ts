import { createContext } from 'svelte';
import { StateRaw } from '$lib/reactivity/state.svelte.js';
import { Derived } from '$lib/reactivity/derived.svelte.js';
import type { WishlistTheme, ThemePalette, ThemePresetName } from './types.js';
import { isCustomTheme, toWishlistTheme } from './types.js';
import { resolveThemePalette } from './apply_theme.js';
import { THEME_PRESETS } from './theme_presets.js';

type WishlistThemeContext = ReturnType<typeof createWishlistThemeContext>;

const [useWishlistTheme, setWishlistThemeInternal] = createContext<WishlistThemeContext>();
export { useWishlistTheme };

export function setWishlistThemeContext(themePreset: string, customThemeColor: string | null) {
	const ctx = createWishlistThemeContext(themePreset, customThemeColor);
	setWishlistThemeInternal(ctx);
	return ctx;
}

function createWishlistThemeContext(initialPreset: string, initialCustomColor: string | null) {
	const savedTheme = toWishlistTheme(initialPreset, initialCustomColor);
	const activeTheme = new StateRaw<WishlistTheme>(savedTheme);

	/** Preview theme applied during editing (null = no preview active) */
	const previewTheme = new StateRaw<WishlistTheme | null>(null);

	/** The effective theme to display (preview takes precedence) */
	const effectiveTheme = new Derived<WishlistTheme>(
		() => previewTheme.current ?? activeTheme.current,
	);

	/** Resolved palette for the effective theme */
	const effectivePalette = new Derived<ThemePalette | null>(() =>
		resolveThemePalette(effectiveTheme.current),
	);

	/** Whether the active (saved) theme is a custom color */
	const isCustom = new Derived<boolean>(() => isCustomTheme(activeTheme.current));

	/** The active preset name (or 'custom' for custom themes) */
	const activePresetName = new Derived<ThemePresetName | 'custom'>(() => {
		const theme = activeTheme.current;
		if (isCustomTheme(theme)) {
			return 'custom';
		}
		return theme;
	});

	/** The custom color string if active, otherwise null */
	const activeCustomColor = new Derived<string | null>(() => {
		const theme = activeTheme.current;
		if (isCustomTheme(theme)) {
			return theme.color;
		}
		return null;
	});

	/** Whether a preview is currently active */
	const isPreviewing = new Derived<boolean>(() => previewTheme.current !== null);

	/** Gradient for preview card display */
	const effectiveGradient = new Derived<string>(() => {
		const theme = effectiveTheme.current;
		if (isCustomTheme(theme)) {
			const palette = resolveThemePalette(theme);
			if (palette !== null) {
				return `linear-gradient(145deg, ${palette['--wishlist-primary']}, ${palette['--wishlist-accent']}, ${palette['--wishlist-muted']})`;
			}
		} else {
			return THEME_PRESETS[theme].gradient;
		}
		return THEME_PRESETS.default.gradient;
	});

	function startPreview(theme: WishlistTheme) {
		previewTheme.current = theme;
	}

	function cancelPreview() {
		previewTheme.current = null;
	}

	function commitTheme(theme: WishlistTheme) {
		activeTheme.current = theme;
		previewTheme.current = null;
	}

	return {
		activeTheme: activeTheme.readonly(),
		previewTheme,
		effectiveTheme: effectiveTheme as Derived<WishlistTheme>,
		effectivePalette: effectivePalette as Derived<ThemePalette | null>,
		effectiveGradient: effectiveGradient as Derived<string>,
		isCustom: isCustom as Derived<boolean>,
		activePresetName: activePresetName as Derived<ThemePresetName | 'custom'>,
		activeCustomColor: activeCustomColor as Derived<string | null>,
		isPreviewing: isPreviewing as Derived<boolean>,
		startPreview,
		cancelPreview,
		commitTheme,
	};
}
