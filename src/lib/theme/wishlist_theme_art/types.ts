export interface MotifPlacement {
	/** Index into the theme's `motifs`. */
	motif: number;
	side: 'left' | 'right' | 'band';
	/** Horizontal position as a 0–1 fraction of the free width (container width minus motif size). */
	x: number;
	/** Percent of the gutter height for `left`/`right`; pixels from the strip top for `band`. */
	y: number;
	/** Rendered width and height in pixels before any responsive scale. */
	size: number;
	/** Degrees. */
	rotate: number;
	/** Parallax drift distance in pixels; larger values read as closer to the viewer. */
	depth: number;
	opacity: number;
}

export interface WishlistThemeArt {
	/** Inner SVG markup for `viewBox="0 0 100 100"`, coloured only through the `--m-*` properties. */
	motifs: readonly string[];
	placements: readonly MotifPlacement[];
}
