import { INK_OUTLINE } from './outline.js';
import type { MotifPlacement } from './types.js';

export const motifs: readonly string[] = [
	`<circle cx="27" cy="87" r="5" fill="var(--m-ink)"/><circle cx="73" cy="87" r="5" fill="var(--m-ink)"/><path d="M38 26 V18 Q38 12 44 12 H56 Q62 12 62 18 V26" fill="none" stroke="var(--m-ink)" stroke-width="4" stroke-linecap="round"/><rect x="14" y="26" width="72" height="58" rx="8" fill="var(--m-a)" ${INK_OUTLINE}/><rect x="25" y="26" width="7" height="58" fill="var(--m-d)" stroke="var(--m-ink)" stroke-width="2"/><rect x="68" y="26" width="7" height="58" fill="var(--m-d)" stroke="var(--m-ink)" stroke-width="2"/><circle cx="50" cy="44" r="9" fill="var(--m-b)" stroke="var(--m-ink)" stroke-width="2"/><path d="M46 44 L49 47 L55 41" fill="none" stroke="var(--m-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><rect x="41" y="61" width="18" height="12" rx="2" transform="rotate(-10 50 67)" fill="var(--m-c)" stroke="var(--m-ink)" stroke-width="2"/><path d="M45 66 H55" transform="rotate(-10 50 67)" stroke="var(--m-paper)" stroke-width="2" stroke-linecap="round"/>`,
	`<g transform="rotate(38 50 50)"><path d="M43 38 L8 58 V66 L43 56Z M57 38 L92 58 V66 L57 56Z" fill="var(--m-c)" ${INK_OUTLINE}/><rect x="21" y="52" width="7" height="12" rx="3" fill="var(--m-a)" stroke="var(--m-ink)" stroke-width="2"/><rect x="72" y="52" width="7" height="12" rx="3" fill="var(--m-a)" stroke="var(--m-ink)" stroke-width="2"/><path d="M44 78 L30 88 V94 L45 89Z M56 78 L70 88 V94 L55 89Z" fill="var(--m-c)" ${INK_OUTLINE}/><path d="M50 4 Q57 4 57 20 V76 Q57 88 50 93 Q43 88 43 76 V20 Q43 4 50 4Z" fill="var(--m-paper)" ${INK_OUTLINE}/><path d="M46 15 Q50 10 54 15 V20 H46Z" fill="var(--m-c)" stroke="var(--m-ink)" stroke-width="2" stroke-linejoin="round"/><path d="M50 30 V70" stroke="var(--m-a)" stroke-width="3" stroke-linecap="round"/></g>`,
	`<path d="M50 80 V88" ${INK_OUTLINE}/><rect x="32" y="86" width="36" height="8" rx="4" fill="var(--m-b)" ${INK_OUTLINE}/><circle cx="50" cy="48" r="32" fill="var(--m-c)" ${INK_OUTLINE}/><path d="M30 30 Q40 24 46 32 Q44 40 50 44 Q46 54 36 52 Q28 46 30 30Z M58 56 Q68 50 74 58 Q72 70 62 72 Q56 66 58 56Z M60 24 Q68 22 72 30 Q64 33 60 24Z" fill="var(--m-d)" stroke="var(--m-ink)" stroke-width="2" stroke-linejoin="round"/><path d="M28 64 Q33 72 42 75" fill="none" stroke="var(--m-paper)" stroke-width="3" stroke-linecap="round"/>`,
	`<path d="M8 34 L32 26 L60 34 L92 26 V82 L60 90 L32 82 L8 90Z" fill="var(--m-paper)" ${INK_OUTLINE}/><path d="M12 46 Q20 40 28 46 Q26 56 15 55Z" fill="var(--m-d)"/><path d="M66 70 Q76 64 86 70 Q82 80 70 79Z" fill="var(--m-c)"/><path d="M32 26 V82 M60 34 V90" stroke="var(--m-ink)" stroke-width="2"/><path d="M16 76 Q28 60 42 70 Q54 78 60 60" fill="none" stroke="var(--m-a)" stroke-width="3" stroke-dasharray="4 5" stroke-linecap="round"/><path d="M62 10 Q80 10 80 28 Q80 42 62 60 Q44 42 44 28 Q44 10 62 10Z" fill="var(--m-a)" ${INK_OUTLINE}/><circle cx="62" cy="28" r="7" fill="var(--m-paper)" ${INK_OUTLINE}/>`,
	`<path d="M30 30 L36 20 H56 L62 30Z" fill="var(--m-c)" ${INK_OUTLINE}/><rect x="16" y="23" width="12" height="8" rx="2" fill="var(--m-a)" ${INK_OUTLINE}/><rect x="10" y="30" width="80" height="54" rx="8" fill="var(--m-c)" ${INK_OUTLINE}/><path d="M10 44 H90" stroke="var(--m-ink)" stroke-width="2"/><rect x="72" y="35" width="11" height="6" rx="2" fill="var(--m-b)" stroke="var(--m-ink)" stroke-width="2"/><circle cx="50" cy="58" r="19" fill="var(--m-paper)" ${INK_OUTLINE}/><circle cx="50" cy="58" r="11" fill="var(--m-ink)"/><circle cx="46" cy="54" r="3.5" fill="var(--m-paper)"/>`,
	`<g transform="rotate(-12 50 40)"><rect x="28" y="8" width="44" height="58" rx="5" fill="var(--m-c)" ${INK_OUTLINE}/><circle cx="50" cy="30" r="10" fill="none" stroke="var(--m-paper)" stroke-width="3"/><path d="M40 30 H60 M50 20 Q43 30 50 40 Q57 30 50 20" fill="none" stroke="var(--m-paper)" stroke-width="2"/><path d="M40 52 H60" stroke="var(--m-paper)" stroke-width="3" stroke-linecap="round"/></g><g transform="rotate(8 50 70)"><path d="M10 52 H90 V64 Q84 64 84 70 Q84 76 90 76 V88 H10 V76 Q16 76 16 70 Q16 64 10 64Z" fill="var(--m-b)" ${INK_OUTLINE}/><path d="M68 55 V85" stroke="var(--m-ink)" stroke-width="2" stroke-dasharray="3 4"/><path d="M24 62 H54 M24 70 H46 M24 78 H56" stroke="var(--m-ink)" stroke-width="2.5" stroke-linecap="round"/><circle cx="78" cy="70" r="4.5" fill="var(--m-a)" stroke="var(--m-ink)" stroke-width="2"/></g>`,
];

export const placements: readonly MotifPlacement[] = [
	{ motif: 1, side: 'left', x: 0.4, y: 3, size: 70, rotate: -6, depth: 110, opacity: 1 },
	{ motif: 5, side: 'left', x: 0.5, y: 15, size: 62, rotate: 8, depth: 40, opacity: 0.75 },
	{ motif: 0, side: 'left', x: 0.36, y: 26, size: 102, rotate: -5, depth: 190, opacity: 1 },
	{ motif: 3, side: 'left', x: 0.2, y: 42, size: 64, rotate: 10, depth: 40, opacity: 0.75 },
	{ motif: 2, side: 'left', x: 0.4, y: 52, size: 98, rotate: 4, depth: 190, opacity: 1 },
	{ motif: 4, side: 'left', x: 0.3, y: 66, size: 82, rotate: -8, depth: 110, opacity: 1 },
	{ motif: 1, side: 'left', x: 0.62, y: 79, size: 58, rotate: 14, depth: 40, opacity: 0.75 },
	{ motif: 5, side: 'left', x: 0.34, y: 89, size: 88, rotate: -3, depth: 110, opacity: 1 },
	{ motif: 3, side: 'right', x: 0.32, y: 4, size: 90, rotate: 6, depth: 110, opacity: 1 },
	{ motif: 1, side: 'right', x: 0.58, y: 16, size: 60, rotate: -10, depth: 40, opacity: 0.75 },
	{ motif: 4, side: 'right', x: 0.34, y: 27, size: 100, rotate: 5, depth: 190, opacity: 1 },
	{ motif: 2, side: 'right', x: 0.3, y: 43, size: 80, rotate: -8, depth: 110, opacity: 1 },
	{ motif: 0, side: 'right', x: 0.42, y: 54, size: 108, rotate: 6, depth: 190, opacity: 1 },
	{ motif: 5, side: 'right', x: 0.26, y: 69, size: 58, rotate: 10, depth: 40, opacity: 0.75 },
	{ motif: 1, side: 'right', x: 0.4, y: 78, size: 86, rotate: -14, depth: 110, opacity: 1 },
	{ motif: 3, side: 'right', x: 0.36, y: 90, size: 62, rotate: 6, depth: 40, opacity: 0.75 },
	{ motif: 0, side: 'band', x: 0.08, y: 8, size: 74, rotate: -6, depth: 30, opacity: 1 },
	{ motif: 3, side: 'band', x: 0.21, y: 20, size: 80, rotate: 4, depth: 70, opacity: 1 },
	{ motif: 1, side: 'band', x: 0.35, y: 4, size: 78, rotate: -8, depth: 30, opacity: 1 },
	{ motif: 4, side: 'band', x: 0.5, y: 16, size: 74, rotate: 6, depth: 70, opacity: 1 },
	{ motif: 2, side: 'band', x: 0.64, y: 8, size: 78, rotate: -4, depth: 30, opacity: 1 },
	{ motif: 5, side: 'band', x: 0.79, y: 22, size: 82, rotate: 8, depth: 70, opacity: 1 },
	{ motif: 1, side: 'band', x: 0.92, y: 10, size: 64, rotate: 12, depth: 30, opacity: 1 },
];
