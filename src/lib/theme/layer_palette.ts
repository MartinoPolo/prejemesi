import { getContext, setContext } from 'svelte';
import type { Palette } from './palettes.js';

const LAYER_PALETTE_KEY = Symbol('layer-palette');

type LayerPalette = () => Palette | undefined;

/**
 * Makes dialogs, menus and popovers opened inside this component take `palette` in dark mode,
 * although they are portalled out of its DOM subtree. Light mode keeps them in the viewer's look,
 * where white layers already match any palette.
 */
export function setLayerPalette(palette: LayerPalette): void {
	setContext(LAYER_PALETTE_KEY, palette);
}

/**
 * Reads the palette for a portalled layer root's `data-dark-palette`; call during component
 * initialisation. Outside a component that set one it yields no palette.
 */
export function getLayerPalette(): LayerPalette {
	return getContext<LayerPalette | undefined>(LAYER_PALETTE_KEY) ?? (() => undefined);
}
