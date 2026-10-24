import { INK_OUTLINE } from './outline.js';
import type { MotifPlacement } from './types.js';

export const motifs: readonly string[] = [
	`<path d="M40 73 Q44 86 52 96 M64 59 Q60 80 52 96" fill="none" stroke="var(--m-ink)" stroke-width="2" stroke-linecap="round"/><ellipse cx="64" cy="32" rx="19" ry="23" fill="var(--m-c)" ${INK_OUTLINE}/><path d="M60 60 L64 54 L68 60Z" fill="var(--m-c)" ${INK_OUTLINE}/><ellipse cx="40" cy="40" rx="22" ry="27" fill="var(--m-a)" ${INK_OUTLINE}/><path d="M35 73 L40 66 L45 73Z" fill="var(--m-a)" ${INK_OUTLINE}/><path d="M28 30 Q31 21 39 18 M58 20 Q61 15 66 14" fill="none" stroke="var(--m-paper)" stroke-width="4" stroke-linecap="round"/>`,
	`<path d="M50 12 L77 84 H23Z" fill="var(--m-b)" ${INK_OUTLINE}/><circle cx="50" cy="42" r="4.5" fill="var(--m-a)"/><circle cx="41" cy="62" r="4.5" fill="var(--m-c)"/><circle cx="59" cy="62" r="4.5" fill="var(--m-a)"/><circle cx="50" cy="76" r="4" fill="var(--m-c)"/><rect x="18" y="80" width="64" height="11" rx="5.5" fill="var(--m-c)" ${INK_OUTLINE}/><circle cx="50" cy="11" r="8" fill="var(--m-a)" ${INK_OUTLINE}/>`,
	`<path d="M33 10 Q38 17 33 21 Q28 17 33 10Z M50 8 Q55 15 50 19 Q45 15 50 8Z M67 10 Q72 17 67 21 Q62 17 67 10Z" fill="var(--m-b)" stroke="var(--m-ink)" stroke-width="2" stroke-linejoin="round"/><rect x="30" y="22" width="6" height="18" rx="2" fill="var(--m-c)" ${INK_OUTLINE}/><rect x="47" y="20" width="6" height="20" rx="2" fill="var(--m-d)" ${INK_OUTLINE}/><rect x="64" y="22" width="6" height="18" rx="2" fill="var(--m-c)" ${INK_OUTLINE}/><rect x="22" y="38" width="56" height="20" rx="5" fill="var(--m-paper)" ${INK_OUTLINE}/><rect x="14" y="56" width="72" height="30" rx="6" fill="var(--m-a)" ${INK_OUTLINE}/><path d="M14 62 Q14 56 20 56 H80 Q86 56 86 62 Q80 70 74 62 Q68 70 62 62 Q56 70 50 62 Q44 70 38 62 Q32 70 26 62 Q20 70 14 62Z" fill="var(--m-paper)" ${INK_OUTLINE}/><circle cx="34" cy="48" r="2.5" fill="var(--m-a)"/><circle cx="50" cy="48" r="2.5" fill="var(--m-c)"/><circle cx="66" cy="48" r="2.5" fill="var(--m-a)"/><path d="M8 88 H92" ${INK_OUTLINE}/>`,
	`<rect x="18" y="42" width="64" height="46" rx="4" fill="var(--m-d)" ${INK_OUTLINE}/><circle cx="30" cy="60" r="3.5" fill="var(--m-paper)"/><circle cx="70" cy="56" r="3.5" fill="var(--m-paper)"/><circle cx="30" cy="78" r="3.5" fill="var(--m-paper)"/><circle cx="70" cy="76" r="3.5" fill="var(--m-paper)"/><rect x="12" y="30" width="76" height="16" rx="3" fill="var(--m-d)" ${INK_OUTLINE}/><rect x="44" y="30" width="12" height="58" fill="var(--m-a)" stroke="var(--m-ink)" stroke-width="2" stroke-linejoin="round"/><path d="M50 30 C40 12 20 14 27 27 C31 34 44 32 50 30Z M50 30 C60 12 80 14 73 27 C69 34 56 32 50 30Z" fill="var(--m-a)" ${INK_OUTLINE}/><circle cx="50" cy="30" r="5.5" fill="var(--m-a)" ${INK_OUTLINE}/>`,
	`<path d="M40 50 Q46 30 58 34 Q70 38 66 24 Q62 12 78 10" fill="none" stroke="var(--m-ink)" stroke-width="9" stroke-linecap="round"/><path d="M40 50 Q46 30 58 34 Q70 38 66 24 Q62 12 78 10" fill="none" stroke="var(--m-a)" stroke-width="4" stroke-linecap="round"/><path d="M10 92 L28 52 L50 74Z" fill="var(--m-b)" ${INK_OUTLINE}/><path d="M20.5 71.5 L29.5 81 M25 62.5 L39 77" stroke="var(--m-a)" stroke-width="4" stroke-linecap="round"/><rect x="72" y="34" width="9" height="9" rx="1.5" transform="rotate(20 76.5 38.5)" fill="var(--m-c)" ${INK_OUTLINE}/><circle cx="86" cy="54" r="5" fill="var(--m-d)" ${INK_OUTLINE}/><rect x="46" y="12" width="8" height="8" rx="1.5" transform="rotate(-15 50 16)" fill="var(--m-b)" ${INK_OUTLINE}/><circle cx="72" cy="72" r="4.5" fill="var(--m-a)" ${INK_OUTLINE}/><path d="M86 22 L90 30 M62 50 L68 54" stroke="var(--m-ink)" stroke-width="3" stroke-linecap="round"/>`,
	`<path d="M46 24 L54.2 46.7 L78.3 47.5 L59.3 62.3 L66 85.5 L46 72 L26 85.5 L32.7 62.3 L13.7 47.5 L37.8 46.7Z" fill="var(--m-b)" ${INK_OUTLINE}/><path d="M80 10 Q82 19 90 21 Q82 23 80 32 Q78 23 70 21 Q78 19 80 10Z" fill="var(--m-c)" ${INK_OUTLINE}/><path d="M82 66 Q83.5 72.5 89 74 Q83.5 75.5 82 82 Q80.5 75.5 75 74 Q80.5 72.5 82 66Z" fill="var(--m-a)" ${INK_OUTLINE}/>`,
];

export const placements: readonly MotifPlacement[] = [
	{ motif: 0, side: 'left', x: 0.38, y: 3, size: 70, rotate: -10, depth: 110, opacity: 1 },
	{ motif: 4, side: 'left', x: 0.3, y: 15, size: 58, rotate: 8, depth: 40, opacity: 0.75 },
	{ motif: 1, side: 'left', x: 0.42, y: 26, size: 96, rotate: -6, depth: 190, opacity: 1 },
	{ motif: 5, side: 'left', x: 0.18, y: 41, size: 60, rotate: 12, depth: 40, opacity: 0.75 },
	{ motif: 2, side: 'left', x: 0.4, y: 51, size: 104, rotate: -4, depth: 190, opacity: 1 },
	{ motif: 0, side: 'left', x: 0.28, y: 66, size: 82, rotate: 9, depth: 110, opacity: 1 },
	{ motif: 5, side: 'left', x: 0.62, y: 79, size: 56, rotate: -14, depth: 40, opacity: 0.75 },
	{ motif: 3, side: 'left', x: 0.36, y: 89, size: 88, rotate: 5, depth: 110, opacity: 1 },
	{ motif: 3, side: 'right', x: 0.32, y: 4, size: 90, rotate: 8, depth: 110, opacity: 1 },
	{ motif: 5, side: 'right', x: 0.58, y: 16, size: 58, rotate: -8, depth: 40, opacity: 0.75 },
	{ motif: 2, side: 'right', x: 0.34, y: 27, size: 100, rotate: 3, depth: 190, opacity: 1 },
	{ motif: 4, side: 'right', x: 0.3, y: 43, size: 82, rotate: -12, depth: 110, opacity: 1 },
	{ motif: 0, side: 'right', x: 0.44, y: 55, size: 110, rotate: 6, depth: 190, opacity: 1 },
	{ motif: 5, side: 'right', x: 0.26, y: 69, size: 54, rotate: 14, depth: 40, opacity: 0.75 },
	{ motif: 1, side: 'right', x: 0.4, y: 78, size: 86, rotate: -7, depth: 110, opacity: 1 },
	{ motif: 4, side: 'right', x: 0.36, y: 90, size: 60, rotate: 10, depth: 40, opacity: 0.75 },
	{ motif: 0, side: 'band', x: 0.08, y: 6, size: 72, rotate: -6, depth: 30, opacity: 1 },
	{ motif: 3, side: 'band', x: 0.21, y: 22, size: 82, rotate: 4, depth: 70, opacity: 1 },
	{ motif: 1, side: 'band', x: 0.36, y: 8, size: 80, rotate: -12, depth: 30, opacity: 1 },
	{ motif: 5, side: 'band', x: 0.5, y: 4, size: 66, rotate: 10, depth: 70, opacity: 1 },
	{ motif: 2, side: 'band', x: 0.64, y: 14, size: 78, rotate: -4, depth: 30, opacity: 1 },
	{ motif: 4, side: 'band', x: 0.79, y: 24, size: 84, rotate: 8, depth: 70, opacity: 1 },
	{ motif: 0, side: 'band', x: 0.92, y: 10, size: 68, rotate: 12, depth: 30, opacity: 1 },
];
