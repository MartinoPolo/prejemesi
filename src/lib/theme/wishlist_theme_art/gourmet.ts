import { INK_OUTLINE } from './outline.js';
import type { MotifPlacement } from './types.js';

export const motifs: readonly string[] = [
	`<path d="M28 60 Q12 56 14 40 Q16 25 32 28 Q36 12 50 12 Q64 12 68 28 Q84 25 86 40 Q88 56 72 60Z" fill="var(--m-paper)" ${INK_OUTLINE}/><path d="M38 46 Q39 37 46 33 M62 33 Q66 39 64 46" fill="none" stroke="var(--m-ink)" stroke-width="2" stroke-linecap="round"/><rect x="28" y="56" width="44" height="28" rx="4" fill="var(--m-paper)" ${INK_OUTLINE}/><rect x="28" y="56" width="44" height="9" rx="2" fill="var(--m-a)" ${INK_OUTLINE}/><path d="M40 69 V80 M50 69 V80 M60 69 V80" stroke="var(--m-ink)" stroke-width="2" stroke-linecap="round"/>`,
	`<g transform="rotate(-28 50 50)"><path d="M50 62 Q22 40 35 17 Q50 -2 65 17 Q78 40 50 62Z" fill="var(--m-paper)" ${INK_OUTLINE}/><path d="M50 62 Q36 40 42 19 Q50 6 58 19 Q64 40 50 62 M50 62 V8" fill="none" stroke="var(--m-ink)" stroke-width="2.5" stroke-linejoin="round"/><rect x="44" y="64" width="12" height="32" rx="6" fill="var(--m-a)" ${INK_OUTLINE}/><rect x="42" y="58" width="16" height="9" rx="2.5" fill="var(--m-b)" ${INK_OUTLINE}/><circle cx="50" cy="88" r="2" fill="var(--m-paper)"/></g>`,
	`<path d="M36 14 Q31 9 36 4 M64 14 Q59 9 64 4" fill="none" stroke="var(--m-ink)" stroke-width="2.5" stroke-linecap="round"/><path d="M16 48 H9 Q4 48 4 54 Q4 60 9 60 H16 M84 48 H91 Q96 48 96 54 Q96 60 91 60 H84" fill="var(--m-b)" ${INK_OUTLINE}/><path d="M16 40 H84 V74 Q84 88 70 88 H30 Q16 88 16 74Z" fill="var(--m-a)" ${INK_OUTLINE}/><path d="M22 52 H78" stroke="var(--m-paper)" stroke-width="4" stroke-linecap="round"/><path d="M12 40 Q14 28 50 26 Q86 28 88 40Z" fill="var(--m-c)" ${INK_OUTLINE}/><rect x="43" y="17" width="14" height="10" rx="3.5" fill="var(--m-b)" ${INK_OUTLINE}/>`,
	`<path d="M24 52 H76 L68 89 H32Z" fill="var(--m-a)" ${INK_OUTLINE}/><path d="M38 57 L40 86 M50 57 V86 M62 57 L60 86" stroke="var(--m-ink)" stroke-width="2" stroke-linecap="round"/><path d="M20 55 Q12 43 25 38 Q25 24 40 24 Q46 12 60 18 Q77 20 75 36 Q88 41 80 55Z" fill="var(--m-paper)" ${INK_OUTLINE}/><path d="M34 34 L38 31 M48 40 L52 42 M62 30 L65 34 M30 46 L34 47 M66 44 L69 41" stroke="var(--m-c)" stroke-width="3" stroke-linecap="round"/><path d="M41 28 L44 26 M56 47 L59 49" stroke="var(--m-b)" stroke-width="3" stroke-linecap="round"/><path d="M57 11 Q59 4 66 2" fill="none" stroke="var(--m-ink)" stroke-width="2" stroke-linecap="round"/><circle cx="56" cy="15" r="7" fill="var(--m-a)" ${INK_OUTLINE}/>`,
	`<path d="M36 30 Q30 23 36 17 Q42 11 36 4 M50 30 Q44 23 50 17 Q56 11 50 4 M64 30 Q58 23 64 17 Q70 11 64 4" fill="none" stroke="var(--m-ink)" stroke-width="2.5" stroke-linecap="round"/><ellipse cx="50" cy="88" rx="38" ry="7" fill="var(--m-c)" ${INK_OUTLINE}/><path d="M71 48 Q88 46 88 59 Q88 72 71 70" fill="none" stroke="var(--m-ink)" stroke-width="10" stroke-linecap="round"/><path d="M71 48 Q88 46 88 59 Q88 72 71 70" fill="none" stroke="var(--m-a)" stroke-width="4" stroke-linecap="round"/><path d="M24 40 V64 Q24 85 50 85 Q76 85 76 64 V40Z" fill="var(--m-a)" ${INK_OUTLINE}/><path d="M28 58 Q50 64 72 58" fill="none" stroke="var(--m-paper)" stroke-width="4" stroke-linecap="round"/><ellipse cx="50" cy="40" rx="26" ry="6.5" fill="var(--m-d)" ${INK_OUTLINE}/><path d="M46 39 Q50 35 54 39 Q50 43 46 39Z" fill="var(--m-paper)"/>`,
	`<path d="M36 44 Q36 35 44 31 V18 H56 V31 Q64 35 64 44 V84 Q64 91 57 91 H43 Q36 91 36 84Z" fill="var(--m-c)" ${INK_OUTLINE}/><rect x="42" y="7" width="16" height="13" rx="3.5" fill="var(--m-d)" ${INK_OUTLINE}/><path d="M41 46 V60" stroke="var(--m-paper)" stroke-width="3" stroke-linecap="round"/><rect x="38" y="56" width="24" height="24" rx="3" fill="var(--m-paper)" ${INK_OUTLINE}/><ellipse cx="48" cy="69" rx="6" ry="5" fill="var(--m-c)" stroke="var(--m-ink)" stroke-width="2"/><path d="M52 64 Q57 58 61 61 Q57 66 52 64Z" fill="var(--m-b)" stroke="var(--m-ink)" stroke-width="1.5" stroke-linejoin="round"/>`,
];

export const placements: readonly MotifPlacement[] = [
	{ motif: 0, side: 'left', x: 0.38, y: 3, size: 78, rotate: -8, depth: 110, opacity: 1 },
	{ motif: 1, side: 'left', x: 0.48, y: 16, size: 64, rotate: 6, depth: 40, opacity: 0.75 },
	{ motif: 2, side: 'left', x: 0.36, y: 27, size: 104, rotate: -3, depth: 190, opacity: 1 },
	{ motif: 5, side: 'left', x: 0.2, y: 42, size: 62, rotate: 10, depth: 40, opacity: 0.75 },
	{ motif: 3, side: 'left', x: 0.4, y: 52, size: 96, rotate: 6, depth: 190, opacity: 1 },
	{ motif: 4, side: 'left', x: 0.3, y: 66, size: 84, rotate: -6, depth: 110, opacity: 1 },
	{ motif: 1, side: 'left', x: 0.62, y: 79, size: 60, rotate: -14, depth: 40, opacity: 0.75 },
	{ motif: 0, side: 'left', x: 0.34, y: 89, size: 88, rotate: 4, depth: 110, opacity: 1 },
	{ motif: 4, side: 'right', x: 0.34, y: 4, size: 88, rotate: 5, depth: 110, opacity: 1 },
	{ motif: 5, side: 'right', x: 0.58, y: 16, size: 62, rotate: -8, depth: 40, opacity: 0.75 },
	{ motif: 3, side: 'right', x: 0.32, y: 27, size: 100, rotate: -6, depth: 190, opacity: 1 },
	{ motif: 1, side: 'right', x: 0.36, y: 43, size: 82, rotate: 12, depth: 110, opacity: 1 },
	{ motif: 2, side: 'right', x: 0.42, y: 54, size: 108, rotate: 4, depth: 190, opacity: 1 },
	{ motif: 5, side: 'right', x: 0.26, y: 69, size: 58, rotate: 12, depth: 40, opacity: 0.75 },
	{ motif: 0, side: 'right', x: 0.4, y: 78, size: 84, rotate: -7, depth: 110, opacity: 1 },
	{ motif: 3, side: 'right', x: 0.36, y: 90, size: 62, rotate: 8, depth: 40, opacity: 0.75 },
	{ motif: 2, side: 'band', x: 0.08, y: 8, size: 74, rotate: -4, depth: 30, opacity: 1 },
	{ motif: 0, side: 'band', x: 0.21, y: 20, size: 78, rotate: 6, depth: 70, opacity: 1 },
	{ motif: 1, side: 'band', x: 0.35, y: 6, size: 76, rotate: -10, depth: 30, opacity: 1 },
	{ motif: 3, side: 'band', x: 0.5, y: 14, size: 78, rotate: 4, depth: 70, opacity: 1 },
	{ motif: 4, side: 'band', x: 0.64, y: 6, size: 80, rotate: -6, depth: 30, opacity: 1 },
	{ motif: 5, side: 'band', x: 0.79, y: 22, size: 72, rotate: 8, depth: 70, opacity: 1 },
	{ motif: 0, side: 'band', x: 0.92, y: 10, size: 66, rotate: 12, depth: 30, opacity: 1 },
];
