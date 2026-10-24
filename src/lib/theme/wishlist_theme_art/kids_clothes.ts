import { INK_OUTLINE } from './outline.js';
import type { MotifPlacement } from './types.js';

export const motifs: readonly string[] = [
	`<path d="M34 14 Q50 26 66 14 L88 28 L80 44 L70 40 L70 74 L60 90 L54 78 H46 L40 90 L30 74 L30 40 L20 44 L12 28Z" fill="var(--m-a)" ${INK_OUTLINE}/><circle cx="50" cy="48" r="7" fill="var(--m-paper)" stroke="var(--m-ink)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M42 82 H58" stroke="var(--m-ink)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`,
	`<path d="M38 12 Q50 22 62 12 L90 26 L80 44 L70 38 V90 H30 V38 L20 44 L10 26Z" fill="var(--m-c)" ${INK_OUTLINE}/><path d="M30 56 H70 M30 66 H70" stroke="var(--m-paper)" stroke-width="5"/><path d="M38 12 Q50 22 62 12" fill="none" ${INK_OUTLINE}/>`,
	`<path d="M38 10 H62 L60 30 L82 88 H18 L40 30Z" fill="var(--m-b)" ${INK_OUTLINE}/><path d="M40 30 H60" ${INK_OUTLINE}/><path d="M28 70 Q50 78 72 70" fill="none" stroke="var(--m-paper)" stroke-width="4"/>`,
	`<path d="M36 10 H64 V56 Q64 64 72 68 L82 74 Q92 82 84 90 Q78 96 66 92 L40 80 Q34 76 36 66Z" fill="var(--m-b)" ${INK_OUTLINE}/><path d="M36 22 H64" ${INK_OUTLINE}/><path d="M36 30 H64" ${INK_OUTLINE}/><path d="M72 68 Q66 80 80 92" fill="var(--m-a)" stroke="var(--m-ink)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`,
	`<path d="M50 86 C20 64 10 46 18 30 C26 14 46 16 50 32 C54 16 74 14 82 30 C90 46 80 64 50 86Z" fill="var(--m-a)" ${INK_OUTLINE}/>`,
	`<path d="M50 10 L61 37 L90 39 L67 57 L75 86 L50 70 L25 86 L33 57 L10 39 L39 37Z" fill="var(--m-b)" ${INK_OUTLINE}/>`,
];

export const placements: readonly MotifPlacement[] = [
	{ motif: 0, side: 'left', x: 0.59, y: 5.8, size: 63, rotate: -4, depth: 40, opacity: 0.75 },
	{ motif: 1, side: 'left', x: 0.26, y: 18.1, size: 83, rotate: 17, depth: 110, opacity: 1 },
	{ motif: 2, side: 'left', x: 0.89, y: 27.9, size: 123, rotate: -13, depth: 190, opacity: 1 },
	{ motif: 0, side: 'left', x: 0.43, y: 39.9, size: 51, rotate: -14, depth: 40, opacity: 0.75 },
	{ motif: 1, side: 'left', x: 0.65, y: 55, size: 80, rotate: -2, depth: 110, opacity: 1 },
	{ motif: 2, side: 'left', x: 0.15, y: 64.7, size: 123, rotate: -16, depth: 190, opacity: 1 },
	{ motif: 0, side: 'left', x: 0.13, y: 75.4, size: 61, rotate: 13, depth: 40, opacity: 0.75 },
	{ motif: 1, side: 'left', x: 0.11, y: 86.8, size: 87, rotate: -7, depth: 110, opacity: 1 },
	{ motif: 3, side: 'right', x: 0.46, y: 7.3, size: 79, rotate: 7, depth: 110, opacity: 1 },
	{ motif: 4, side: 'right', x: 0.47, y: 14.8, size: 103, rotate: -2, depth: 190, opacity: 1 },
	{ motif: 5, side: 'right', x: 0.43, y: 28, size: 62, rotate: -14, depth: 40, opacity: 0.75 },
	{ motif: 3, side: 'right', x: 0.36, y: 41.2, size: 83, rotate: -6, depth: 110, opacity: 1 },
	{ motif: 4, side: 'right', x: 0.85, y: 54.6, size: 121, rotate: -11, depth: 190, opacity: 1 },
	{ motif: 5, side: 'right', x: 0.35, y: 66.5, size: 59, rotate: 11, depth: 40, opacity: 0.75 },
	{ motif: 3, side: 'right', x: 0.41, y: 78.3, size: 89, rotate: -5, depth: 110, opacity: 1 },
	{ motif: 4, side: 'right', x: 0.74, y: 91.1, size: 107, rotate: -4, depth: 190, opacity: 1 },
	{ motif: 0, side: 'band', x: 0.07, y: 20.7, size: 77, rotate: 9, depth: 30, opacity: 1 },
	{ motif: 3, side: 'band', x: 0.19, y: 23.1, size: 72, rotate: -6, depth: 70, opacity: 1 },
	{ motif: 1, side: 'band', x: 0.35, y: 20.6, size: 72, rotate: -5, depth: 30, opacity: 1 },
	{ motif: 4, side: 'band', x: 0.53, y: 20.6, size: 85, rotate: -4, depth: 70, opacity: 1 },
	{ motif: 2, side: 'band', x: 0.65, y: 13.3, size: 76, rotate: 3, depth: 30, opacity: 1 },
	{ motif: 5, side: 'band', x: 0.82, y: 13.3, size: 86, rotate: 3, depth: 70, opacity: 1 },
	{ motif: 0, side: 'band', x: 0.94, y: 16.8, size: 85, rotate: -7, depth: 30, opacity: 1 },
];
