import { INK_OUTLINE } from './outline.js';
import type { MotifPlacement } from './types.js';

export const motifs: readonly string[] = [
	`<path d="M24 76 Q6 76 8 60 Q10 46 26 48 Q26 26 48 26 Q66 26 70 42 Q90 40 92 58 Q94 76 74 76Z" fill="var(--m-paper)" ${INK_OUTLINE}/>`,
	`<path d="M50 10 L61 37 L90 39 L67 57 L75 86 L50 70 L25 86 L33 57 L10 39 L39 37Z" fill="var(--m-b)" ${INK_OUTLINE}/>`,
	`<path d="M40 8 H60 L62 24 H38Z" fill="var(--m-a)" ${INK_OUTLINE}/><rect x="30" y="24" width="40" height="66" rx="12" fill="var(--m-paper)" ${INK_OUTLINE}/><path d="M30 60 H70 V78 Q70 90 58 90 H42 Q30 90 30 78Z" fill="var(--m-c)" stroke="var(--m-ink)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M40 38 H50 M40 48 H50" stroke="var(--m-ink)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`,
	`<path d="M64 10 Q30 14 24 48 Q20 84 58 90 Q78 92 90 78 Q56 80 48 52 Q42 26 64 10Z" fill="var(--m-b)" ${INK_OUTLINE}/><circle cx="46" cy="66" r="4" fill="var(--m-c)"/>`,
	`<path d="M54 54 L76 76" stroke="var(--m-ink)" stroke-width="10" stroke-linecap="round"/><path d="M54 54 L76 76" stroke="var(--m-b)" stroke-width="5" stroke-linecap="round"/><circle cx="82" cy="82" r="11" fill="none" stroke="var(--m-ink)" stroke-width="7"/><circle cx="82" cy="82" r="11" fill="none" stroke="var(--m-c)" stroke-width="3"/><circle cx="38" cy="38" r="26" fill="var(--m-a)" ${INK_OUTLINE}/><circle cx="30" cy="30" r="5" fill="var(--m-paper)" stroke="var(--m-ink)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="46" cy="32" r="5" fill="var(--m-b)" stroke="var(--m-ink)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="34" cy="48" r="5" fill="var(--m-c)" stroke="var(--m-ink)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="48" cy="46" r="4" fill="var(--m-paper)" stroke="var(--m-ink)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`,
	`<path d="M18 34 H66 Q86 34 86 54 V58 H18Z" fill="var(--m-a)" ${INK_OUTLINE}/><path d="M18 34 Q18 10 46 12 V34" fill="var(--m-b)" ${INK_OUTLINE}/><circle cx="30" cy="78" r="9" fill="var(--m-paper)" ${INK_OUTLINE}/><circle cx="74" cy="78" r="9" fill="var(--m-paper)" ${INK_OUTLINE}/><path d="M86 40 L94 30" ${INK_OUTLINE}/>`,
];

export const placements: readonly MotifPlacement[] = [
	{ motif: 0, side: 'left', x: 0.77, y: 6.4, size: 51, rotate: 17, depth: 40, opacity: 0.75 },
	{ motif: 1, side: 'left', x: 0.56, y: 16.3, size: 83, rotate: -9, depth: 110, opacity: 1 },
	{ motif: 2, side: 'left', x: 0.29, y: 28.7, size: 106, rotate: -15, depth: 190, opacity: 1 },
	{ motif: 0, side: 'left', x: 0.52, y: 43.4, size: 52, rotate: 1, depth: 40, opacity: 0.75 },
	{ motif: 1, side: 'left', x: 0.83, y: 50.8, size: 94, rotate: -3, depth: 110, opacity: 1 },
	{ motif: 2, side: 'left', x: 0.81, y: 63.6, size: 109, rotate: 7, depth: 190, opacity: 1 },
	{ motif: 0, side: 'left', x: 0.39, y: 78.1, size: 61, rotate: 0, depth: 40, opacity: 0.75 },
	{ motif: 1, side: 'left', x: 0.86, y: 88.6, size: 89, rotate: 3, depth: 110, opacity: 1 },
	{ motif: 3, side: 'right', x: 0.18, y: 3.5, size: 82, rotate: -2, depth: 110, opacity: 1 },
	{ motif: 4, side: 'right', x: 0.61, y: 14.6, size: 119, rotate: 1, depth: 190, opacity: 1 },
	{ motif: 5, side: 'right', x: 0.47, y: 30.4, size: 53, rotate: -7, depth: 40, opacity: 0.75 },
	{ motif: 3, side: 'right', x: 0.48, y: 42.1, size: 90, rotate: -6, depth: 110, opacity: 1 },
	{ motif: 4, side: 'right', x: 0.78, y: 50.8, size: 102, rotate: -10, depth: 190, opacity: 1 },
	{ motif: 5, side: 'right', x: 0.23, y: 64.2, size: 61, rotate: -16, depth: 40, opacity: 0.75 },
	{ motif: 3, side: 'right', x: 0.8, y: 77.4, size: 82, rotate: 8, depth: 110, opacity: 1 },
	{ motif: 4, side: 'right', x: 0.86, y: 88.8, size: 123, rotate: -13, depth: 190, opacity: 1 },
	{ motif: 0, side: 'band', x: 0.08, y: 15, size: 69, rotate: 11, depth: 30, opacity: 1 },
	{ motif: 3, side: 'band', x: 0.23, y: 19.9, size: 64, rotate: -8, depth: 70, opacity: 1 },
	{ motif: 1, side: 'band', x: 0.37, y: 7.7, size: 67, rotate: 11, depth: 30, opacity: 1 },
	{ motif: 4, side: 'band', x: 0.5, y: 17.3, size: 84, rotate: 11, depth: 70, opacity: 1 },
	{ motif: 2, side: 'band', x: 0.66, y: 18.5, size: 83, rotate: -12, depth: 30, opacity: 1 },
	{ motif: 5, side: 'band', x: 0.78, y: 21.6, size: 82, rotate: -6, depth: 70, opacity: 1 },
	{ motif: 0, side: 'band', x: 0.92, y: 4.8, size: 66, rotate: 11, depth: 30, opacity: 1 },
];
