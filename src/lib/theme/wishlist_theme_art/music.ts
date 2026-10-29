import { INK_OUTLINE } from './outline.js';
import type { MotifPlacement } from './types.js';

export const motifs: readonly string[] = [
	`<path d="M41 74 V28 M81 66 V18" stroke="var(--m-ink)" stroke-width="9" stroke-linecap="round"/><path d="M41 74 V28 M81 66 V18" stroke="var(--m-a)" stroke-width="3" stroke-linecap="round"/><path d="M38 20 L84 10 V23 L38 33Z" fill="var(--m-a)" ${INK_OUTLINE}/><ellipse cx="29" cy="76" rx="14" ry="10" transform="rotate(-20 29 76)" fill="var(--m-a)" ${INK_OUTLINE}/><ellipse cx="69" cy="68" rx="14" ry="10" transform="rotate(-20 69 68)" fill="var(--m-a)" ${INK_OUTLINE}/><path d="M22 74 Q25 70 30 70 M62 66 Q65 62 70 62" fill="none" stroke="var(--m-paper)" stroke-width="3" stroke-linecap="round"/>`,
	`<g transform="rotate(-24 50 50)"><rect x="45" y="6" width="10" height="34" rx="2" fill="var(--m-d)" ${INK_OUTLINE}/><path d="M45 16 H55 M45 24 H55 M45 32 H55" stroke="var(--m-ink)" stroke-width="1.5"/><rect x="42" y="0" width="16" height="11" rx="3" fill="var(--m-b)" ${INK_OUTLINE}/><path d="M50 32 C65 32 69 42 64 51 C82 55 78 94 50 94 C22 94 18 55 36 51 C31 42 35 32 50 32Z" fill="var(--m-a)" ${INK_OUTLINE}/><circle cx="50" cy="62" r="8" fill="var(--m-ink)"/><rect x="40" y="78" width="20" height="5" rx="2.5" fill="var(--m-d)" stroke="var(--m-ink)" stroke-width="2"/><path d="M48 10 V80 M52 10 V80" stroke="var(--m-paper)" stroke-width="1"/></g>`,
	`<path d="M18 60 V48 Q18 14 50 14 Q82 14 82 48 V60" fill="none" stroke="var(--m-ink)" stroke-width="12" stroke-linecap="round"/><path d="M18 60 V48 Q18 14 50 14 Q82 14 82 48 V60" fill="none" stroke="var(--m-c)" stroke-width="6" stroke-linecap="round"/><rect x="25" y="54" width="11" height="26" rx="5" fill="var(--m-paper)" ${INK_OUTLINE}/><rect x="64" y="54" width="11" height="26" rx="5" fill="var(--m-paper)" ${INK_OUTLINE}/><rect x="9" y="48" width="21" height="38" rx="9" fill="var(--m-a)" ${INK_OUTLINE}/><rect x="70" y="48" width="21" height="38" rx="9" fill="var(--m-a)" ${INK_OUTLINE}/><path d="M15 58 V70 M85 58 V70" stroke="var(--m-paper)" stroke-width="3" stroke-linecap="round"/>`,
	`<path d="M40 50 H60 L56 86 Q50 93 44 86Z" fill="var(--m-c)" ${INK_OUTLINE}/><rect x="33" y="8" width="34" height="42" rx="17" fill="var(--m-paper)" ${INK_OUTLINE}/><path d="M37 20 H63 M34 30 H66 M50 9 V42" stroke="var(--m-ink)" stroke-width="2"/><rect x="31" y="40" width="38" height="10" rx="4" fill="var(--m-a)" ${INK_OUTLINE}/><path d="M78 18 Q84 27 78 36 M86 12 Q96 27 86 42 M22 18 Q16 27 22 36" fill="none" stroke="var(--m-ink)" stroke-width="8" stroke-linecap="round"/><path d="M78 18 Q84 27 78 36 M86 12 Q96 27 86 42 M22 18 Q16 27 22 36" fill="none" stroke="var(--m-b)" stroke-width="3" stroke-linecap="round"/>`,
	`<path d="M14 40 V74 Q50 90 86 74 V40" fill="var(--m-a)" ${INK_OUTLINE}/><path d="M20 52 L32 76 L44 55 L56 78 L68 55 L80 72" fill="none" stroke="var(--m-b)" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/><ellipse cx="50" cy="40" rx="36" ry="12" fill="var(--m-paper)" ${INK_OUTLINE}/><path d="M18 8 L44 36 M84 10 L60 36" stroke="var(--m-ink)" stroke-width="9" stroke-linecap="round"/><path d="M18 8 L44 36 M84 10 L60 36" stroke="var(--m-d)" stroke-width="4" stroke-linecap="round"/><circle cx="44" cy="36" r="4.5" fill="var(--m-d)" ${INK_OUTLINE}/><circle cx="60" cy="36" r="4.5" fill="var(--m-d)" ${INK_OUTLINE}/>`,
	`<rect x="8" y="26" width="84" height="50" rx="7" fill="var(--m-a)" ${INK_OUTLINE}/><circle cx="20" cy="34" r="3.5" fill="var(--m-b)" stroke="var(--m-ink)" stroke-width="2"/><circle cx="31" cy="34" r="3.5" fill="var(--m-b)" stroke="var(--m-ink)" stroke-width="2"/><rect x="58" y="30" width="26" height="7" rx="2" fill="var(--m-c)" stroke="var(--m-ink)" stroke-width="2"/><rect x="14" y="42" width="72" height="28" rx="2" fill="var(--m-paper)" ${INK_OUTLINE}/><path d="M24.3 42 V70 M34.6 42 V70 M44.9 42 V70 M55.1 42 V70 M65.4 42 V70 M75.7 42 V70" stroke="var(--m-ink)" stroke-width="2"/><path d="M21.3 42 H27.3 V58 H21.3Z M31.6 42 H37.6 V58 H31.6Z M52.1 42 H58.1 V58 H52.1Z M62.4 42 H68.4 V58 H62.4Z M72.7 42 H78.7 V58 H72.7Z" fill="var(--m-ink)"/>`,
];

export const placements: readonly MotifPlacement[] = [
	{ motif: 0, side: 'left', x: 0.36, y: 4, size: 74, rotate: -8, depth: 110, opacity: 1 },
	{ motif: 3, side: 'left', x: 0.5, y: 16, size: 60, rotate: 10, depth: 40, opacity: 0.75 },
	{ motif: 1, side: 'left', x: 0.36, y: 26, size: 108, rotate: 4, depth: 190, opacity: 1 },
	{ motif: 0, side: 'left', x: 0.2, y: 42, size: 58, rotate: 12, depth: 40, opacity: 0.75 },
	{ motif: 2, side: 'left', x: 0.4, y: 52, size: 98, rotate: -6, depth: 190, opacity: 1 },
	{ motif: 3, side: 'left', x: 0.3, y: 67, size: 82, rotate: -10, depth: 110, opacity: 1 },
	{ motif: 0, side: 'left', x: 0.62, y: 79, size: 56, rotate: 6, depth: 40, opacity: 0.75 },
	{ motif: 5, side: 'left', x: 0.34, y: 89, size: 90, rotate: -3, depth: 110, opacity: 1 },
	{ motif: 4, side: 'right', x: 0.34, y: 3, size: 92, rotate: 6, depth: 110, opacity: 1 },
	{ motif: 0, side: 'right', x: 0.56, y: 16, size: 58, rotate: -10, depth: 40, opacity: 0.75 },
	{ motif: 5, side: 'right', x: 0.3, y: 27, size: 104, rotate: -5, depth: 190, opacity: 1 },
	{ motif: 2, side: 'right', x: 0.4, y: 42, size: 80, rotate: 9, depth: 110, opacity: 1 },
	{ motif: 1, side: 'right', x: 0.32, y: 54, size: 112, rotate: 18, depth: 190, opacity: 1 },
	{ motif: 0, side: 'right', x: 0.26, y: 69, size: 56, rotate: -12, depth: 40, opacity: 0.75 },
	{ motif: 4, side: 'right', x: 0.42, y: 78, size: 86, rotate: -4, depth: 110, opacity: 1 },
	{ motif: 3, side: 'right', x: 0.36, y: 90, size: 62, rotate: 8, depth: 40, opacity: 0.75 },
	{ motif: 0, side: 'band', x: 0.08, y: 8, size: 70, rotate: -8, depth: 30, opacity: 1 },
	{ motif: 4, side: 'band', x: 0.21, y: 22, size: 80, rotate: 4, depth: 70, opacity: 1 },
	{ motif: 1, side: 'band', x: 0.36, y: 4, size: 86, rotate: 14, depth: 30, opacity: 1 },
	{ motif: 3, side: 'band', x: 0.5, y: 14, size: 70, rotate: -6, depth: 70, opacity: 1 },
	{ motif: 2, side: 'band', x: 0.64, y: 8, size: 76, rotate: 6, depth: 30, opacity: 1 },
	{ motif: 5, side: 'band', x: 0.79, y: 24, size: 82, rotate: -4, depth: 70, opacity: 1 },
	{ motif: 0, side: 'band', x: 0.92, y: 12, size: 66, rotate: 10, depth: 30, opacity: 1 },
];
