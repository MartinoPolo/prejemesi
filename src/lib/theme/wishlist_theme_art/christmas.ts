import { INK_OUTLINE } from './outline.js';
import type { MotifPlacement } from './types.js';

export const motifs: readonly string[] = [
	`<path d="M50 6 L72 36 H60 L80 62 H64 L86 90 H14 L36 62 H20 L40 36 H28Z" fill="var(--m-c)" ${INK_OUTLINE}/><circle cx="44" cy="50" r="3.5" fill="var(--m-a)"/><circle cx="60" cy="70" r="3.5" fill="var(--m-b)"/><circle cx="38" cy="78" r="3.5" fill="var(--m-b)"/>`,
	`<g stroke="var(--m-d)" stroke-width="5" stroke-linecap="round" fill="none"><path d="M50 10 V90 M40 18 L50 26 L60 18 M40 82 L50 74 L60 82" transform="rotate(0 50 50)"/><path d="M50 10 V90 M40 18 L50 26 L60 18 M40 82 L50 74 L60 82" transform="rotate(60 50 50)"/><path d="M50 10 V90 M40 18 L50 26 L60 18 M40 82 L50 74 L60 82" transform="rotate(120 50 50)"/></g>`,
	`<path d="M36 92 V34 Q36 12 56 12 Q76 12 76 32" fill="none" stroke="var(--m-ink)" stroke-width="18" stroke-linecap="round"/><path d="M36 92 V34 Q36 12 56 12 Q76 12 76 32" fill="none" stroke="var(--m-paper)" stroke-width="12" stroke-linecap="round"/><path d="M36 92 V34 Q36 12 56 12 Q76 12 76 32" fill="none" stroke="var(--m-a)" stroke-width="12" stroke-dasharray="7 8"/>`,
	`<path d="M50 4 V14" stroke="var(--m-ink)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><rect x="42" y="12" width="16" height="10" rx="2" fill="var(--m-b)" ${INK_OUTLINE}/><circle cx="50" cy="56" r="32" fill="var(--m-a)" ${INK_OUTLINE}/><path d="M20 50 Q50 62 80 50" fill="none" stroke="var(--m-paper)" stroke-width="4"/><path d="M22 66 Q50 78 78 66" fill="none" stroke="var(--m-b)" stroke-width="4"/>`,
	`<rect x="14" y="40" width="72" height="48" rx="4" fill="var(--m-a)" ${INK_OUTLINE}/><rect x="10" y="28" width="80" height="16" rx="3" fill="var(--m-a)" ${INK_OUTLINE}/><rect x="44" y="28" width="12" height="60" fill="var(--m-b)" stroke="var(--m-ink)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M50 28 Q30 6 26 20 Q24 30 50 28 Q76 30 74 20 Q70 6 50 28Z" fill="var(--m-b)" ${INK_OUTLINE}/>`,
	`<path d="M50 10 L61 37 L90 39 L67 57 L75 86 L50 70 L25 86 L33 57 L10 39 L39 37Z" fill="var(--m-b)" ${INK_OUTLINE}/>`,
];

export const placements: readonly MotifPlacement[] = [
	{ motif: 0, side: 'left', x: 0.68, y: 5, size: 52, rotate: 14, depth: 40, opacity: 0.75 },
	{ motif: 1, side: 'left', x: 0.52, y: 18.7, size: 87, rotate: 5, depth: 110, opacity: 1 },
	{ motif: 2, side: 'left', x: 0.38, y: 28, size: 106, rotate: -16, depth: 190, opacity: 1 },
	{ motif: 0, side: 'left', x: 0.67, y: 43, size: 59, rotate: -3, depth: 40, opacity: 0.75 },
	{ motif: 1, side: 'left', x: 0.42, y: 52.4, size: 82, rotate: 5, depth: 110, opacity: 1 },
	{ motif: 2, side: 'left', x: 0.39, y: 67.7, size: 122, rotate: 18, depth: 190, opacity: 1 },
	{ motif: 0, side: 'left', x: 0.27, y: 76.6, size: 50, rotate: -12, depth: 40, opacity: 0.75 },
	{ motif: 1, side: 'left', x: 0.44, y: 86.5, size: 82, rotate: 17, depth: 110, opacity: 1 },
	{ motif: 3, side: 'right', x: 0.68, y: 2, size: 90, rotate: 16, depth: 110, opacity: 1 },
	{ motif: 4, side: 'right', x: 0.16, y: 14.9, size: 105, rotate: 18, depth: 190, opacity: 1 },
	{ motif: 5, side: 'right', x: 0.31, y: 31.6, size: 54, rotate: -17, depth: 40, opacity: 0.75 },
	{ motif: 3, side: 'right', x: 0.52, y: 42.7, size: 81, rotate: -3, depth: 110, opacity: 1 },
	{ motif: 4, side: 'right', x: 0.28, y: 54, size: 112, rotate: 6, depth: 190, opacity: 1 },
	{ motif: 5, side: 'right', x: 0.4, y: 63.6, size: 62, rotate: 16, depth: 40, opacity: 0.75 },
	{ motif: 3, side: 'right', x: 0.36, y: 75.2, size: 81, rotate: 1, depth: 110, opacity: 1 },
	{ motif: 4, side: 'right', x: 0.18, y: 89, size: 117, rotate: 9, depth: 190, opacity: 1 },
	{ motif: 0, side: 'band', x: 0.06, y: 4.1, size: 80, rotate: 14, depth: 30, opacity: 1 },
	{ motif: 3, side: 'band', x: 0.24, y: 21.2, size: 83, rotate: -9, depth: 70, opacity: 1 },
	{ motif: 1, side: 'band', x: 0.36, y: 25, size: 81, rotate: 5, depth: 30, opacity: 1 },
	{ motif: 4, side: 'band', x: 0.51, y: 10.7, size: 64, rotate: -13, depth: 70, opacity: 1 },
	{ motif: 2, side: 'band', x: 0.66, y: 23.3, size: 75, rotate: 4, depth: 30, opacity: 1 },
	{ motif: 5, side: 'band', x: 0.8, y: 25.5, size: 76, rotate: 14, depth: 70, opacity: 1 },
	{ motif: 0, side: 'band', x: 0.93, y: 16.1, size: 71, rotate: 7, depth: 30, opacity: 1 },
];
