import { INK_OUTLINE } from './outline.js';
import type { MotifPlacement } from './types.js';

export const motifs: readonly string[] = [
	`<path d="M50 48 Q67 48 73 65 Q78 84 62 84 Q56 82 50 82 Q44 82 38 84 Q22 84 27 65 Q33 48 50 48Z" fill="var(--m-a)" ${INK_OUTLINE}/><ellipse cx="25" cy="40" rx="8" ry="11" transform="rotate(-24 25 40)" fill="var(--m-a)" ${INK_OUTLINE}/><ellipse cx="41" cy="24" rx="8.5" ry="12" transform="rotate(-8 41 24)" fill="var(--m-a)" ${INK_OUTLINE}/><ellipse cx="59" cy="24" rx="8.5" ry="12" transform="rotate(8 59 24)" fill="var(--m-a)" ${INK_OUTLINE}/><ellipse cx="75" cy="40" rx="8" ry="11" transform="rotate(24 75 40)" fill="var(--m-a)" ${INK_OUTLINE}/><path d="M40 60 Q44 55 50 55" fill="none" stroke="var(--m-paper)" stroke-width="3" stroke-linecap="round"/>`,
	`<g transform="rotate(-30 50 50)"><path d="M28 43 H72 A10 10 0 1 1 86 50 A10 10 0 1 1 72 57 H28 A10 10 0 1 1 14 50 A10 10 0 1 1 28 43Z" fill="var(--m-paper)" ${INK_OUTLINE}/><path d="M34 47 H62" stroke="var(--m-b)" stroke-width="3" stroke-linecap="round"/></g>`,
	`<path d="M36 32 Q46 16 58 30" fill="var(--m-b)" ${INK_OUTLINE}/><path d="M42 66 Q48 80 56 70" fill="var(--m-b)" ${INK_OUTLINE}/><path d="M12 50 Q36 22 66 46 L88 30 Q81 50 88 70 L66 54 Q36 78 12 50Z" fill="var(--m-a)" ${INK_OUTLINE}/><path d="M40 37 Q47 50 40 63" fill="none" ${INK_OUTLINE}/><circle cx="27" cy="46" r="5.5" fill="var(--m-paper)" stroke="var(--m-ink)" stroke-width="2"/><circle cx="27" cy="46" r="2.5" fill="var(--m-ink)"/><path d="M50 44 Q54 48 50 52 M58 46 Q61 50 58 54" fill="none" stroke="var(--m-b)" stroke-width="3" stroke-linecap="round"/>`,
	`<ellipse cx="50" cy="54" rx="28" ry="27" fill="var(--m-b)" ${INK_OUTLINE}/><ellipse cx="62" cy="45" rx="8" ry="7" fill="var(--m-a)"/><path d="M34 31 Q17 25 13 44 Q11 63 22 69 Q31 63 33 48Z" fill="var(--m-a)" ${INK_OUTLINE}/><path d="M66 31 Q83 25 87 44 Q89 63 78 69 Q69 63 67 48Z" fill="var(--m-a)" ${INK_OUTLINE}/><ellipse cx="50" cy="68" rx="15" ry="11" fill="var(--m-paper)" ${INK_OUTLINE}/><circle cx="40" cy="48" r="3.5" fill="var(--m-ink)"/><circle cx="61" cy="47" r="3.5" fill="var(--m-ink)"/><path d="M47 73 Q50 84 53 73Z" fill="var(--m-d)" stroke="var(--m-ink)" stroke-width="2" stroke-linejoin="round"/><path d="M50 65 V71 M43 71 Q50 76 57 71" fill="none" stroke="var(--m-ink)" stroke-width="2.5" stroke-linecap="round"/><ellipse cx="50" cy="62" rx="6" ry="4" fill="var(--m-ink)"/>`,
	`<path d="M22 40 L24 13 L42 29 Q50 27 58 29 L76 13 L78 40 Q87 56 78 72 Q66 87 50 87 Q34 87 22 72 Q13 56 22 40Z" fill="var(--m-a)" ${INK_OUTLINE}/><path d="M28 32 L29 22 L37 29Z M72 32 L71 22 L63 29Z" fill="var(--m-d)"/><path d="M44 34 L46 42 M50 32 V42 M56 34 L54 42" stroke="var(--m-ink)" stroke-width="2.5" stroke-linecap="round"/><ellipse cx="38" cy="53" rx="4" ry="5.5" fill="var(--m-ink)"/><ellipse cx="62" cy="53" rx="4" ry="5.5" fill="var(--m-ink)"/><path d="M46 61 H54 L50 66Z" fill="var(--m-d)" stroke="var(--m-ink)" stroke-width="2" stroke-linejoin="round"/><path d="M50 66 Q50 71 44 72 M50 66 Q50 71 56 72 M30 62 H12 M30 68 L14 74 M70 62 H88 M70 68 L86 74" fill="none" stroke="var(--m-ink)" stroke-width="2" stroke-linecap="round"/>`,
	`<path d="M66 76 Q84 76 86 86 Q88 96 76 94" fill="none" ${INK_OUTLINE}/><circle cx="46" cy="52" r="30" fill="var(--m-c)" ${INK_OUTLINE}/><path d="M22 38 Q46 52 42 81 M31 27 Q58 40 57 79 M50 23 Q72 38 70 68 M18 60 Q44 52 66 30" fill="none" stroke="var(--m-ink)" stroke-width="2" stroke-linecap="round"/><path d="M78 20 L92 6 M74 14 L86 2" stroke="var(--m-ink)" stroke-width="3" stroke-linecap="round"/><circle cx="74" cy="24" r="3.5" fill="var(--m-d)" stroke="var(--m-ink)" stroke-width="2"/><circle cx="70" cy="18" r="3.5" fill="var(--m-d)" stroke="var(--m-ink)" stroke-width="2"/>`,
];

export const placements: readonly MotifPlacement[] = [
	{ motif: 0, side: 'left', x: 0.4, y: 3, size: 62, rotate: -14, depth: 40, opacity: 0.75 },
	{ motif: 3, side: 'left', x: 0.36, y: 14, size: 96, rotate: -6, depth: 190, opacity: 1 },
	{ motif: 1, side: 'left', x: 0.28, y: 29, size: 80, rotate: 10, depth: 110, opacity: 1 },
	{ motif: 0, side: 'left', x: 0.16, y: 42, size: 58, rotate: 18, depth: 40, opacity: 0.75 },
	{ motif: 5, side: 'left', x: 0.4, y: 52, size: 100, rotate: -2, depth: 190, opacity: 1 },
	{ motif: 2, side: 'left', x: 0.3, y: 66, size: 84, rotate: -10, depth: 110, opacity: 1 },
	{ motif: 0, side: 'left', x: 0.66, y: 79, size: 56, rotate: 6, depth: 40, opacity: 0.75 },
	{ motif: 4, side: 'left', x: 0.36, y: 89, size: 92, rotate: 4, depth: 110, opacity: 1 },
	{ motif: 4, side: 'right', x: 0.32, y: 4, size: 92, rotate: 6, depth: 110, opacity: 1 },
	{ motif: 0, side: 'right', x: 0.6, y: 17, size: 56, rotate: 20, depth: 40, opacity: 0.75 },
	{ motif: 2, side: 'right', x: 0.34, y: 27, size: 100, rotate: 8, depth: 190, opacity: 1 },
	{ motif: 1, side: 'right', x: 0.3, y: 43, size: 78, rotate: -14, depth: 110, opacity: 1 },
	{ motif: 3, side: 'right', x: 0.42, y: 54, size: 108, rotate: 5, depth: 190, opacity: 1 },
	{ motif: 0, side: 'right', x: 0.26, y: 69, size: 54, rotate: -16, depth: 40, opacity: 0.75 },
	{ motif: 5, side: 'right', x: 0.4, y: 78, size: 86, rotate: -6, depth: 110, opacity: 1 },
	{ motif: 0, side: 'right', x: 0.36, y: 90, size: 60, rotate: 12, depth: 40, opacity: 0.75 },
	{ motif: 3, side: 'band', x: 0.08, y: 6, size: 76, rotate: -6, depth: 30, opacity: 1 },
	{ motif: 0, side: 'band', x: 0.21, y: 22, size: 62, rotate: 14, depth: 70, opacity: 1 },
	{ motif: 4, side: 'band', x: 0.35, y: 6, size: 80, rotate: 6, depth: 30, opacity: 1 },
	{ motif: 1, side: 'band', x: 0.5, y: 16, size: 74, rotate: -10, depth: 70, opacity: 1 },
	{ motif: 2, side: 'band', x: 0.64, y: 8, size: 80, rotate: 4, depth: 30, opacity: 1 },
	{ motif: 5, side: 'band', x: 0.79, y: 20, size: 76, rotate: -6, depth: 70, opacity: 1 },
	{ motif: 0, side: 'band', x: 0.92, y: 10, size: 62, rotate: -12, depth: 30, opacity: 1 },
];
