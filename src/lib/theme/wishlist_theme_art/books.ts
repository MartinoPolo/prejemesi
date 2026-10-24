import { INK_OUTLINE } from './outline.js';
import type { MotifPlacement } from './types.js';

export const motifs: readonly string[] = [
	`<rect x="14" y="62" width="72" height="16" rx="3" fill="var(--m-a)" ${INK_OUTLINE}/><rect x="20" y="46" width="62" height="16" rx="3" fill="var(--m-b)" ${INK_OUTLINE}/><rect x="12" y="30" width="66" height="16" rx="3" fill="var(--m-c)" ${INK_OUTLINE}/><path d="M18 70 H40 M26 54 H50 M18 38 H34" stroke="var(--m-paper)" stroke-width="3"/><path d="M14 78 H86" ${INK_OUTLINE}/>`,
	`<circle cx="28" cy="54" r="18" fill="var(--m-paper)" ${INK_OUTLINE}/><circle cx="72" cy="54" r="18" fill="var(--m-paper)" ${INK_OUTLINE}/><path d="M46 52 Q50 46 54 52" fill="none" ${INK_OUTLINE}/><path d="M10 50 L4 40 M90 50 L96 40" ${INK_OUTLINE}/><path d="M20 48 L28 42" stroke="var(--m-d)" stroke-width="3" stroke-linecap="round"/>`,
	`<path d="M30 8 H70 V92 L50 76 L30 92Z" fill="var(--m-b)" ${INK_OUTLINE}/><circle cx="50" cy="30" r="8" fill="var(--m-paper)" stroke="var(--m-ink)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`,
	`<path d="M50 28 Q30 16 8 22 V82 Q30 76 50 86 Q70 76 92 82 V22 Q70 16 50 28Z" fill="var(--m-paper)" ${INK_OUTLINE}/><path d="M50 28 V86" ${INK_OUTLINE}/><path d="M16 36 Q30 32 42 38 M16 48 Q30 44 42 50 M58 38 Q70 32 84 36 M58 50 Q70 44 84 48" fill="none" stroke="var(--m-a)" stroke-width="3" stroke-linecap="round"/>`,
	`<path d="M18 30 H70 V74 Q70 88 56 88 H32 Q18 88 18 74Z" fill="var(--m-a)" ${INK_OUTLINE}/><path d="M70 40 Q88 40 88 54 Q88 68 70 66" fill="none" ${INK_OUTLINE}/><path d="M34 22 Q30 14 36 8 M48 22 Q44 14 50 8" fill="none" stroke="var(--m-ink)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`,
	`<path d="M30 14 H70 L80 46 H20Z" fill="var(--m-b)" ${INK_OUTLINE}/><path d="M50 46 V82" ${INK_OUTLINE}/><ellipse cx="50" cy="86" rx="20" ry="5" fill="var(--m-a)" ${INK_OUTLINE}/>`,
];

export const placements: readonly MotifPlacement[] = [
	{ motif: 0, side: 'left', x: 0.44, y: 5.8, size: 55, rotate: 4, depth: 40, opacity: 0.75 },
	{ motif: 1, side: 'left', x: 0.39, y: 17.8, size: 95, rotate: 0, depth: 110, opacity: 1 },
	{ motif: 2, side: 'left', x: 0.6, y: 29.1, size: 119, rotate: -7, depth: 190, opacity: 1 },
	{ motif: 0, side: 'left', x: 0.12, y: 41.4, size: 52, rotate: 8, depth: 40, opacity: 0.75 },
	{ motif: 1, side: 'left', x: 0.55, y: 50, size: 90, rotate: 7, depth: 110, opacity: 1 },
	{ motif: 2, side: 'left', x: 0.52, y: 63.7, size: 122, rotate: 5, depth: 190, opacity: 1 },
	{ motif: 0, side: 'left', x: 0.63, y: 78.4, size: 63, rotate: -13, depth: 40, opacity: 0.75 },
	{ motif: 1, side: 'left', x: 0.52, y: 86.5, size: 85, rotate: 10, depth: 110, opacity: 1 },
	{ motif: 3, side: 'right', x: 0.66, y: 7.8, size: 88, rotate: 2, depth: 110, opacity: 1 },
	{ motif: 4, side: 'right', x: 0.85, y: 19.7, size: 122, rotate: 12, depth: 190, opacity: 1 },
	{ motif: 5, side: 'right', x: 0.59, y: 25.9, size: 56, rotate: -13, depth: 40, opacity: 0.75 },
	{ motif: 3, side: 'right', x: 0.89, y: 41.8, size: 81, rotate: -11, depth: 110, opacity: 1 },
	{ motif: 4, side: 'right', x: 0.29, y: 51.4, size: 113, rotate: -9, depth: 190, opacity: 1 },
	{ motif: 5, side: 'right', x: 0.8, y: 65, size: 56, rotate: 11, depth: 40, opacity: 0.75 },
	{ motif: 3, side: 'right', x: 0.84, y: 79.3, size: 92, rotate: 12, depth: 110, opacity: 1 },
	{ motif: 4, side: 'right', x: 0.54, y: 90.2, size: 106, rotate: 10, depth: 190, opacity: 1 },
	{ motif: 0, side: 'band', x: 0.05, y: 6.8, size: 79, rotate: 1, depth: 30, opacity: 1 },
	{ motif: 3, side: 'band', x: 0.23, y: 18.5, size: 77, rotate: -9, depth: 70, opacity: 1 },
	{ motif: 1, side: 'band', x: 0.37, y: 16.8, size: 81, rotate: -13, depth: 30, opacity: 1 },
	{ motif: 4, side: 'band', x: 0.51, y: 12.6, size: 72, rotate: -13, depth: 70, opacity: 1 },
	{ motif: 2, side: 'band', x: 0.66, y: 10.6, size: 82, rotate: 1, depth: 30, opacity: 1 },
	{ motif: 5, side: 'band', x: 0.81, y: 8.3, size: 67, rotate: -3, depth: 70, opacity: 1 },
	{ motif: 0, side: 'band', x: 0.92, y: 15.4, size: 71, rotate: -12, depth: 30, opacity: 1 },
];
