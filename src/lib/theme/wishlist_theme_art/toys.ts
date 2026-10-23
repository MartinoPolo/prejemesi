import { INK_OUTLINE } from './outline.js';
import type { MotifPlacement } from './types.js';

export const motifs: readonly string[] = [
	`<rect x="18" y="22" width="60" height="60" rx="6" fill="var(--m-a)" ${INK_OUTLINE}/><path d="M18 34 L30 18 H90 L78 34" fill="var(--m-b)" ${INK_OUTLINE}/><path d="M78 82 L90 66 V18 L78 34Z" fill="var(--m-c)" ${INK_OUTLINE}/><path d="M36 68 L44.5 44 H51.5 L60 68 H53 L51.5 63 H44.5 L43 68Z M45.8 57 H50.2 L48 50.4Z" fill-rule="evenodd" fill="var(--m-paper)" stroke="var(--m-ink)" stroke-width="1.5" stroke-linejoin="round"/>`,
	`<circle cx="50" cy="52" r="34" fill="var(--m-a)" ${INK_OUTLINE}/><path d="M16 52 Q50 30 84 52" fill="none" ${INK_OUTLINE}/><path d="M22 70 Q50 50 78 70" fill="var(--m-b)" ${INK_OUTLINE}/><path d="M50 18 Q36 50 50 86" fill="none" ${INK_OUTLINE}/>`,
	`<rect x="46" y="12" width="8" height="70" rx="4" fill="var(--m-paper)" ${INK_OUTLINE}/><ellipse cx="50" cy="80" rx="34" ry="9" fill="var(--m-a)" ${INK_OUTLINE}/><ellipse cx="50" cy="66" rx="28" ry="8" fill="var(--m-b)" ${INK_OUTLINE}/><ellipse cx="50" cy="53" rx="22" ry="7" fill="var(--m-c)" ${INK_OUTLINE}/><ellipse cx="50" cy="41" rx="16" ry="6" fill="var(--m-d)" ${INK_OUTLINE}/><circle cx="50" cy="20" r="8" fill="var(--m-a)" ${INK_OUTLINE}/>`,
	`<ellipse cx="50" cy="66" rx="34" ry="20" fill="var(--m-b)" ${INK_OUTLINE}/><circle cx="66" cy="38" r="16" fill="var(--m-b)" ${INK_OUTLINE}/><path d="M80 38 L94 42 L80 46Z" fill="var(--m-c)" ${INK_OUTLINE}/><circle cx="70" cy="34" r="3" fill="var(--m-ink)"/><path d="M30 64 Q44 56 52 70" fill="none" ${INK_OUTLINE}/>`,
	`<circle cx="28" cy="26" r="11" fill="var(--m-c)" ${INK_OUTLINE}/><circle cx="72" cy="26" r="11" fill="var(--m-c)" ${INK_OUTLINE}/><ellipse cx="50" cy="78" rx="26" ry="18" fill="var(--m-c)" ${INK_OUTLINE}/><circle cx="50" cy="44" r="26" fill="var(--m-c)" ${INK_OUTLINE}/><ellipse cx="50" cy="54" rx="11" ry="8" fill="var(--m-paper)" stroke="var(--m-ink)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="50" cy="51" r="3.5" fill="var(--m-ink)"/><circle cx="40" cy="40" r="3" fill="var(--m-ink)"/><circle cx="60" cy="40" r="3" fill="var(--m-ink)"/>`,
	`<path d="M50 10 L61 37 L90 39 L67 57 L75 86 L50 70 L25 86 L33 57 L10 39 L39 37Z" fill="var(--m-b)" ${INK_OUTLINE}/>`,
];

export const placements: readonly MotifPlacement[] = [
	{ motif: 0, side: 'left', x: 0.41, y: 2.7, size: 56, rotate: -12, depth: 40, opacity: 0.75 },
	{ motif: 1, side: 'left', x: 0.37, y: 17.2, size: 83, rotate: -6, depth: 110, opacity: 1 },
	{ motif: 2, side: 'left', x: 0.39, y: 26.9, size: 101, rotate: 17, depth: 190, opacity: 1 },
	{ motif: 0, side: 'left', x: 0.15, y: 42.5, size: 62, rotate: -9, depth: 40, opacity: 0.75 },
	{ motif: 1, side: 'left', x: 0.4, y: 51.9, size: 81, rotate: -2, depth: 110, opacity: 1 },
	{ motif: 2, side: 'left', x: 0.32, y: 62.5, size: 113, rotate: -2, depth: 190, opacity: 1 },
	{ motif: 0, side: 'left', x: 0.75, y: 78.6, size: 64, rotate: 0, depth: 40, opacity: 0.75 },
	{ motif: 1, side: 'left', x: 0.54, y: 91.6, size: 87, rotate: -10, depth: 110, opacity: 1 },
	{ motif: 3, side: 'right', x: 0.3, y: 5.4, size: 87, rotate: 10, depth: 110, opacity: 1 },
	{ motif: 4, side: 'right', x: 0.35, y: 14.3, size: 116, rotate: -2, depth: 190, opacity: 1 },
	{ motif: 5, side: 'right', x: 0.31, y: 29.7, size: 57, rotate: 10, depth: 40, opacity: 0.75 },
	{ motif: 3, side: 'right', x: 0.31, y: 41.6, size: 79, rotate: -1, depth: 110, opacity: 1 },
	{ motif: 4, side: 'right', x: 0.29, y: 53.3, size: 106, rotate: -9, depth: 190, opacity: 1 },
	{ motif: 5, side: 'right', x: 0.39, y: 67.5, size: 57, rotate: -1, depth: 40, opacity: 0.75 },
	{ motif: 3, side: 'right', x: 0.28, y: 77.9, size: 87, rotate: 5, depth: 110, opacity: 1 },
	{ motif: 4, side: 'right', x: 0.42, y: 86.2, size: 112, rotate: 9, depth: 190, opacity: 1 },
	{ motif: 0, side: 'band', x: 0.1, y: 4.4, size: 71, rotate: 1, depth: 30, opacity: 1 },
	{ motif: 3, side: 'band', x: 0.2, y: 25.6, size: 86, rotate: 1, depth: 70, opacity: 1 },
	{ motif: 1, side: 'band', x: 0.35, y: 10.1, size: 84, rotate: -15, depth: 30, opacity: 1 },
	{ motif: 4, side: 'band', x: 0.51, y: 5.8, size: 78, rotate: -8, depth: 70, opacity: 1 },
	{ motif: 2, side: 'band', x: 0.62, y: 8.6, size: 70, rotate: 14, depth: 30, opacity: 1 },
	{ motif: 5, side: 'band', x: 0.79, y: 24.5, size: 81, rotate: -11, depth: 70, opacity: 1 },
	{ motif: 0, side: 'band', x: 0.91, y: 17.1, size: 65, rotate: -12, depth: 30, opacity: 1 },
];
