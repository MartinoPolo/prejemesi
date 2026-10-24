import { INK_OUTLINE } from './outline.js';
import type { MotifPlacement } from './types.js';

export const motifs: readonly string[] = [
	`<circle cx="38" cy="58" r="24" fill="none" stroke="var(--m-ink)" stroke-width="9"/><circle cx="38" cy="58" r="24" fill="none" stroke="var(--m-a)" stroke-width="5"/><circle cx="62" cy="58" r="24" fill="none" stroke="var(--m-ink)" stroke-width="9"/><circle cx="62" cy="58" r="24" fill="none" stroke="var(--m-a)" stroke-width="5"/><path d="M54 22 L62 30 L70 22 L66 16 H58Z" fill="var(--m-paper)" stroke="var(--m-ink)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`,
	`<g fill="var(--m-b)" stroke="var(--m-ink)" stroke-width="2.5"><ellipse cx="50" cy="28" rx="12" ry="20" transform="rotate(0 50 50)"/><ellipse cx="50" cy="28" rx="12" ry="20" transform="rotate(72 50 50)"/><ellipse cx="50" cy="28" rx="12" ry="20" transform="rotate(144 50 50)"/><ellipse cx="50" cy="28" rx="12" ry="20" transform="rotate(216 50 50)"/><ellipse cx="50" cy="28" rx="12" ry="20" transform="rotate(288 50 50)"/></g><circle cx="50" cy="50" r="10" fill="var(--m-a)" stroke="var(--m-ink)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`,
	`<rect x="18" y="56" width="64" height="30" rx="4" fill="var(--m-b)" ${INK_OUTLINE}/><rect x="28" y="34" width="44" height="22" rx="4" fill="var(--m-paper)" ${INK_OUTLINE}/><path d="M18 66 Q26 72 34 66 Q42 72 50 66 Q58 72 66 66 Q74 72 82 66" fill="none" stroke="var(--m-ink)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M50 34 V22" ${INK_OUTLINE}/><path d="M50 10 Q56 16 50 20 Q44 16 50 10Z" fill="var(--m-a)" stroke="var(--m-ink)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`,
	`<path d="M50 94 Q50 50 54 8" fill="none" stroke="var(--m-ink)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><g fill="var(--m-c)" stroke="var(--m-ink)" stroke-width="2"><ellipse cx="38" cy="74" rx="12" ry="6" transform="rotate(-30 38 74)"/><ellipse cx="64" cy="64" rx="12" ry="6" transform="rotate(30 64 64)"/><ellipse cx="38" cy="48" rx="12" ry="6" transform="rotate(-30 38 48)"/><ellipse cx="66" cy="38" rx="12" ry="6" transform="rotate(30 66 38)"/><ellipse cx="44" cy="22" rx="10" ry="5" transform="rotate(-40 44 22)"/></g>`,
	`<path d="M26 10 H46 L42 46 Q36 52 30 46Z" fill="var(--m-a)" stroke="var(--m-ink)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M36 50 V84 M26 86 H46" stroke="var(--m-ink)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M54 14 H74 L70 50 Q64 56 58 50Z" fill="var(--m-a)" stroke="var(--m-ink)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M64 54 V86 M54 88 H74" stroke="var(--m-ink)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="50" cy="8" r="2.5" fill="var(--m-b)"/><circle cx="58" cy="4" r="2" fill="var(--m-b)"/>`,
];

export const placements: readonly MotifPlacement[] = [
	{ motif: 0, side: 'left', x: 0.12, y: 5.8, size: 59, rotate: -3, depth: 40, opacity: 0.75 },
	{ motif: 1, side: 'left', x: 0.3, y: 17.8, size: 92, rotate: -9, depth: 110, opacity: 1 },
	{ motif: 2, side: 'left', x: 0.18, y: 28.5, size: 108, rotate: 2, depth: 190, opacity: 1 },
	{ motif: 0, side: 'left', x: 0.52, y: 41, size: 62, rotate: 4, depth: 40, opacity: 0.75 },
	{ motif: 1, side: 'left', x: 0.85, y: 54.9, size: 78, rotate: 2, depth: 110, opacity: 1 },
	{ motif: 2, side: 'left', x: 0.32, y: 67.5, size: 105, rotate: -14, depth: 190, opacity: 1 },
	{ motif: 0, side: 'left', x: 0.32, y: 75.4, size: 61, rotate: -16, depth: 40, opacity: 0.75 },
	{ motif: 1, side: 'left', x: 0.46, y: 87.7, size: 81, rotate: 18, depth: 110, opacity: 1 },
	{ motif: 3, side: 'right', x: 0.87, y: 3.8, size: 91, rotate: -11, depth: 110, opacity: 1 },
	{ motif: 4, side: 'right', x: 0.9, y: 17.9, size: 102, rotate: 9, depth: 190, opacity: 1 },
	{ motif: 3, side: 'right', x: 0.67, y: 31.1, size: 58, rotate: -18, depth: 40, opacity: 0.75 },
	{ motif: 3, side: 'right', x: 0.63, y: 42.5, size: 88, rotate: 0, depth: 110, opacity: 1 },
	{ motif: 4, side: 'right', x: 0.82, y: 54.1, size: 117, rotate: 14, depth: 190, opacity: 1 },
	{ motif: 3, side: 'right', x: 0.58, y: 63.3, size: 61, rotate: 17, depth: 40, opacity: 0.75 },
	{ motif: 3, side: 'right', x: 0.23, y: 76.5, size: 83, rotate: -9, depth: 110, opacity: 1 },
	{ motif: 4, side: 'right', x: 0.16, y: 87.8, size: 103, rotate: -6, depth: 190, opacity: 1 },
	{ motif: 0, side: 'band', x: 0.06, y: 6, size: 70, rotate: -3, depth: 30, opacity: 1 },
	{ motif: 3, side: 'band', x: 0.2, y: 17.4, size: 86, rotate: -4, depth: 70, opacity: 1 },
	{ motif: 1, side: 'band', x: 0.35, y: 23.2, size: 66, rotate: 12, depth: 30, opacity: 1 },
	{ motif: 4, side: 'band', x: 0.47, y: 16.7, size: 76, rotate: 2, depth: 70, opacity: 1 },
	{ motif: 2, side: 'band', x: 0.64, y: 15.5, size: 70, rotate: -11, depth: 30, opacity: 1 },
	{ motif: 3, side: 'band', x: 0.8, y: 11, size: 81, rotate: 10, depth: 70, opacity: 1 },
	{ motif: 0, side: 'band', x: 0.93, y: 25.9, size: 65, rotate: 5, depth: 30, opacity: 1 },
];
