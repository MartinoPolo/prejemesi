import { createContext } from 'svelte';
import { StateRaw } from '$lib/reactivity/state.svelte.js';
import { Derived } from '$lib/reactivity/derived.svelte.js';
import type { WishlistTheme, ThemePalette, ThemePresetName } from './types.js';
import { isCustomTheme } from './types.js';
import { resolveThemePalette } from './apply_theme.js';
import { THEME_PRESETS } from './theme_presets.js';

type WishlistThemeContext = ReturnType<typeof createWishlistThemeContext>;

const [useWishlistTheme, setWishlistThemeInternal] = createContext<WishlistThemeContext>();
/** @public */
export { useWishlistTheme };

export function setWishlistThemeContext(getTheme: () => WishlistTheme) {
	const ctx = createWishlistThemeContext(getTheme);
	setWishlistThemeInternal(ctx);
	return ctx;
}

function createWishlistThemeContext(getTheme: () => WishlistTheme) {
	const activeTheme = new Derived(getTheme);

	const previewTheme = new StateRaw<WishlistTheme | null>(null);

	const effectiveTheme = new Derived<WishlistTheme>(
		() => previewTheme.current ?? activeTheme.current,
	);

	const effectivePalette = new Derived<ThemePalette | null>(() =>
		resolveThemePalette(effectiveTheme.current),
	);

	const isCustom = new Derived<boolean>(() => isCustomTheme(activeTheme.current));

	const activePresetName = new Derived<ThemePresetName | 'custom'>(() => {
		const theme = activeTheme.current;
		if (isCustomTheme(theme)) {
			return 'custom';
		}
		return theme;
	});

	const activeCustomColor = new Derived<string | null>(() => {
		const theme = activeTheme.current;
		if (isCustomTheme(theme)) {
			return theme.color;
		}
		return null;
	});

	const isPreviewing = new Derived<boolean>(() => previewTheme.current !== null);

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

	return {
		activeTheme,
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
	};
}
