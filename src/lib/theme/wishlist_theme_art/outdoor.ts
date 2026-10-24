import { INK_OUTLINE } from './outline.js';
import type { MotifPlacement } from './types.js';

export const motifs: readonly string[] = [
	`<path d="M4 88 L36 30 L52 56 L66 38 L96 88Z" fill="var(--m-c)" ${INK_OUTLINE}/><path d="M36 30 L28 46 L36 42 L44 48Z" fill="var(--m-paper)" stroke="var(--m-ink)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M66 38 L60 48 L66 46 L72 50Z" fill="var(--m-paper)" stroke="var(--m-ink)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`,
	`<path d="M8 86 L50 16 L92 86Z" fill="var(--m-a)" ${INK_OUTLINE}/><path d="M50 16 L36 86 H64Z" fill="var(--m-b)" ${INK_OUTLINE}/><path d="M50 16 L50 8" ${INK_OUTLINE}/>`,
	`<path d="M34 24 Q34 10 50 10 Q66 10 66 24" fill="none" ${INK_OUTLINE}/><rect x="20" y="22" width="60" height="68" rx="16" fill="var(--m-a)" ${INK_OUTLINE}/><rect x="30" y="56" width="40" height="24" rx="6" fill="var(--m-b)" ${INK_OUTLINE}/><path d="M30 40 H70" ${INK_OUTLINE}/>`,
	`<path d="M50 6 L72 36 H60 L80 62 H64 L86 90 H14 L36 62 H20 L40 36 H28Z" fill="var(--m-c)" ${INK_OUTLINE}/><circle cx="44" cy="50" r="3.5" fill="var(--m-a)"/><circle cx="60" cy="70" r="3.5" fill="var(--m-b)"/><circle cx="38" cy="78" r="3.5" fill="var(--m-b)"/>`,
	`<circle cx="50" cy="50" r="38" fill="var(--m-paper)" ${INK_OUTLINE}/><circle cx="50" cy="50" r="30" fill="none" stroke="var(--m-ink)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M50 22 L58 50 L50 78 L42 50Z" fill="var(--m-a)" stroke="var(--m-ink)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M50 50 L58 50 L50 78 L42 50Z" fill="var(--m-c)" stroke="var(--m-ink)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`,
	`<path d="M22 16 H48 V58 L80 66 Q90 70 88 84 H20Z" fill="var(--m-c)" ${INK_OUTLINE}/><path d="M20 84 H88" stroke="var(--m-ink)" stroke-width="7"/><path d="M28 28 H44 M28 38 H44 M28 48 H44" stroke="var(--m-ink)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`,
];

export const placements: readonly MotifPlacement[] = [
	{ motif: 0, side: 'left', x: 0.36, y: 2.2, size: 59, rotate: 9, depth: 40, opacity: 0.75 },
	{ motif: 1, side: 'left', x: 0.25, y: 13.9, size: 86, rotate: 15, depth: 110, opacity: 1 },
	{ motif: 2, side: 'left', x: 0.29, y: 28.6, size: 123, rotate: -12, depth: 190, opacity: 1 },
	{ motif: 0, side: 'left', x: 0.29, y: 42.2, size: 57, rotate: 2, depth: 40, opacity: 0.75 },
	{ motif: 1, side: 'left', x: 0.79, y: 53.7, size: 90, rotate: -4, depth: 110, opacity: 1 },
	{ motif: 2, side: 'left', x: 0.29, y: 62.2, size: 111, rotate: 15, depth: 190, opacity: 1 },
	{ motif: 0, side: 'left', x: 0.46, y: 75.1, size: 61, rotate: 7, depth: 40, opacity: 0.75 },
	{ motif: 1, side: 'left', x: 0.6, y: 91.4, size: 80, rotate: 9, depth: 110, opacity: 1 },
	{ motif: 3, side: 'right', x: 0.81, y: 6.3, size: 90, rotate: 15, depth: 110, opacity: 1 },
	{ motif: 4, side: 'right', x: 0.17, y: 19.7, size: 122, rotate: 7, depth: 190, opacity: 1 },
	{ motif: 5, side: 'right', x: 0.67, y: 30.6, size: 55, rotate: 8, depth: 40, opacity: 0.75 },
	{ motif: 3, side: 'right', x: 0.65, y: 38.6, size: 95, rotate: -4, depth: 110, opacity: 1 },
	{ motif: 4, side: 'right', x: 0.31, y: 54.6, size: 112, rotate: 12, depth: 190, opacity: 1 },
	{ motif: 5, side: 'right', x: 0.73, y: 62.1, size: 53, rotate: 9, depth: 40, opacity: 0.75 },
	{ motif: 3, side: 'right', x: 0.68, y: 74, size: 92, rotate: 12, depth: 110, opacity: 1 },
	{ motif: 4, side: 'right', x: 0.31, y: 86.2, size: 111, rotate: -10, depth: 190, opacity: 1 },
	{ motif: 0, side: 'band', x: 0.05, y: 25.4, size: 85, rotate: -14, depth: 30, opacity: 1 },
	{ motif: 3, side: 'band', x: 0.23, y: 9.8, size: 76, rotate: 9, depth: 70, opacity: 1 },
	{ motif: 1, side: 'band', x: 0.34, y: 13.3, size: 72, rotate: -5, depth: 30, opacity: 1 },
	{ motif: 4, side: 'band', x: 0.52, y: 20.5, size: 77, rotate: -13, depth: 70, opacity: 1 },
	{ motif: 2, side: 'band', x: 0.66, y: 5.1, size: 64, rotate: -14, depth: 30, opacity: 1 },
	{ motif: 5, side: 'band', x: 0.8, y: 15, size: 84, rotate: -2, depth: 70, opacity: 1 },
	{ motif: 0, side: 'band', x: 0.92, y: 24.9, size: 81, rotate: 15, depth: 30, opacity: 1 },
];
