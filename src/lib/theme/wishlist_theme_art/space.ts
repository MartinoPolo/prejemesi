import { INK_OUTLINE } from './outline.js';
import type { MotifPlacement } from './types.js';

export const motifs: readonly string[] = [
	`<path d="M38 66 Q40 82 50 95 Q60 82 62 66Z" fill="var(--m-b)" ${INK_OUTLINE}/><path d="M44 66 Q46 78 50 85 Q54 78 56 66Z" fill="var(--m-a)"/><path d="M33 50 L18 70 V82 L34 72Z M67 50 L82 70 V82 L66 72Z" fill="var(--m-a)" ${INK_OUTLINE}/><path d="M50 8 Q72 28 67 68 H33 Q28 28 50 8Z" fill="var(--m-paper)" ${INK_OUTLINE}/><path d="M50 8 Q59 15 63 24 Q50 19 37 24 Q41 15 50 8Z" fill="var(--m-a)" ${INK_OUTLINE}/><circle cx="50" cy="40" r="9" fill="var(--m-c)" ${INK_OUTLINE}/><path d="M46 37 Q48 34 51 34" fill="none" stroke="var(--m-paper)" stroke-width="2.5" stroke-linecap="round"/><rect x="38" y="64" width="24" height="7" rx="2" fill="var(--m-d)" ${INK_OUTLINE}/>`,
	`<g transform="rotate(-20 50 50)"><path d="M8 50 A42 12 0 0 1 92 50" fill="none" stroke="var(--m-ink)" stroke-width="10" stroke-linecap="round"/><path d="M8 50 A42 12 0 0 1 92 50" fill="none" stroke="var(--m-b)" stroke-width="4" stroke-linecap="round"/></g><circle cx="50" cy="50" r="25" fill="var(--m-c)" ${INK_OUTLINE}/><path d="M29 42 Q50 49 71 40 M30 60 Q48 54 68 62" fill="none" stroke="var(--m-d)" stroke-width="4" stroke-linecap="round"/><circle cx="58" cy="32" r="3" fill="var(--m-paper)"/><g transform="rotate(-20 50 50)"><path d="M92 50 A42 12 0 0 1 8 50" fill="none" stroke="var(--m-ink)" stroke-width="10" stroke-linecap="round"/><path d="M92 50 A42 12 0 0 1 8 50" fill="none" stroke="var(--m-b)" stroke-width="4" stroke-linecap="round"/></g>`,
	`<path d="M46.7 18 A34 34 0 1 0 77.6 64.4 A28 28 0 0 1 46.7 18Z" fill="var(--m-b)" ${INK_OUTLINE}/><circle cx="28" cy="56" r="5" fill="var(--m-d)" stroke="var(--m-ink)" stroke-width="2"/><circle cx="43" cy="75" r="4" fill="var(--m-d)" stroke="var(--m-ink)" stroke-width="2"/><circle cx="26" cy="38" r="2.5" fill="var(--m-d)" stroke="var(--m-ink)" stroke-width="2"/><path d="M82 14 Q83.5 20.5 90 22 Q83.5 23.5 82 30 Q80.5 23.5 74 22 Q80.5 20.5 82 14Z" fill="var(--m-paper)" ${INK_OUTLINE}/>`,
	`<path d="M40 30 L47.1 48.3 L66.6 49.3 L51.4 61.7 L56.5 80.7 L40 70 L23.5 80.7 L28.6 61.7 L13.4 49.3 L32.9 48.3Z" fill="var(--m-b)" ${INK_OUTLINE}/><path d="M76 12 L79.5 22.1 L89.3 22.7 L81.7 28.9 L84.2 38.3 L76 33 L67.8 38.3 L70.3 28.9 L62.7 22.7 L72.5 22.1Z" fill="var(--m-d)" ${INK_OUTLINE}/><path d="M80 62 Q81.5 70.5 90 72 Q81.5 73.5 80 82 Q78.5 73.5 70 72 Q78.5 70.5 80 62Z" fill="var(--m-c)" ${INK_OUTLINE}/><circle cx="22" cy="20" r="3" fill="var(--m-paper)" stroke="var(--m-ink)" stroke-width="2"/><circle cx="56" cy="14" r="2.5" fill="var(--m-paper)" stroke="var(--m-ink)" stroke-width="2"/><circle cx="66" cy="90" r="2.5" fill="var(--m-paper)" stroke="var(--m-ink)" stroke-width="2"/>`,
	`<rect x="24" y="72" width="52" height="18" rx="9" fill="var(--m-a)" ${INK_OUTLINE}/><path d="M66 18 L74 8" ${INK_OUTLINE}/><circle cx="75" cy="7" r="4" fill="var(--m-b)" ${INK_OUTLINE}/><rect x="11" y="38" width="9" height="20" rx="3" fill="var(--m-a)" ${INK_OUTLINE}/><rect x="80" y="38" width="9" height="20" rx="3" fill="var(--m-a)" ${INK_OUTLINE}/><circle cx="50" cy="47" r="32" fill="var(--m-paper)" ${INK_OUTLINE}/><rect x="26" y="29" width="48" height="34" rx="17" fill="var(--m-c)" ${INK_OUTLINE}/><path d="M35 41 Q38 35 46 34" fill="none" stroke="var(--m-paper)" stroke-width="4" stroke-linecap="round"/><circle cx="62" cy="52" r="2.5" fill="var(--m-paper)"/>`,
	`<path d="M57 24 Q34 46 10 90 Q46 70 77 45Z" fill="var(--m-c)" ${INK_OUTLINE}/><path d="M60 32 Q40 54 24 78 Q48 64 70 44Z" fill="var(--m-d)"/><circle cx="68" cy="34" r="15" fill="var(--m-b)" ${INK_OUTLINE}/><path d="M61 28 Q64 24 69 24" fill="none" stroke="var(--m-paper)" stroke-width="3" stroke-linecap="round"/><circle cx="30" cy="40" r="2.5" fill="var(--m-paper)" stroke="var(--m-ink)" stroke-width="2"/><circle cx="76" cy="74" r="3" fill="var(--m-paper)" stroke="var(--m-ink)" stroke-width="2"/>`,
];

export const placements: readonly MotifPlacement[] = [
	{ motif: 2, side: 'left', x: 0.4, y: 3, size: 64, rotate: -8, depth: 40, opacity: 0.75 },
	{ motif: 0, side: 'left', x: 0.34, y: 14, size: 98, rotate: 14, depth: 190, opacity: 1 },
	{ motif: 3, side: 'left', x: 0.2, y: 30, size: 66, rotate: 6, depth: 40, opacity: 0.75 },
	{ motif: 1, side: 'left', x: 0.42, y: 40, size: 108, rotate: -6, depth: 190, opacity: 1 },
	{ motif: 5, side: 'left', x: 0.3, y: 55, size: 82, rotate: 4, depth: 110, opacity: 1 },
	{ motif: 3, side: 'left', x: 0.6, y: 68, size: 58, rotate: -12, depth: 40, opacity: 0.75 },
	{ motif: 4, side: 'left', x: 0.36, y: 78, size: 96, rotate: 8, depth: 190, opacity: 1 },
	{ motif: 2, side: 'left', x: 0.24, y: 91, size: 70, rotate: -4, depth: 110, opacity: 1 },
	{ motif: 1, side: 'right', x: 0.36, y: 4, size: 92, rotate: 10, depth: 110, opacity: 1 },
	{ motif: 3, side: 'right', x: 0.62, y: 17, size: 60, rotate: -6, depth: 40, opacity: 0.75 },
	{ motif: 4, side: 'right', x: 0.3, y: 26, size: 104, rotate: -8, depth: 190, opacity: 1 },
	{ motif: 2, side: 'right', x: 0.4, y: 42, size: 74, rotate: 12, depth: 110, opacity: 1 },
	{ motif: 0, side: 'right', x: 0.28, y: 53, size: 112, rotate: -16, depth: 190, opacity: 1 },
	{ motif: 3, side: 'right', x: 0.5, y: 67, size: 56, rotate: 4, depth: 40, opacity: 0.75 },
	{ motif: 5, side: 'right', x: 0.38, y: 77, size: 88, rotate: -2, depth: 110, opacity: 1 },
	{ motif: 1, side: 'right', x: 0.3, y: 90, size: 66, rotate: 8, depth: 40, opacity: 0.75 },
	{ motif: 0, side: 'band', x: 0.08, y: 8, size: 76, rotate: 12, depth: 30, opacity: 1 },
	{ motif: 3, side: 'band', x: 0.2, y: 20, size: 66, rotate: -4, depth: 70, opacity: 1 },
	{ motif: 1, side: 'band', x: 0.35, y: 6, size: 86, rotate: -10, depth: 30, opacity: 1 },
	{ motif: 4, side: 'band', x: 0.5, y: 16, size: 80, rotate: 6, depth: 70, opacity: 1 },
	{ motif: 2, side: 'band', x: 0.64, y: 4, size: 70, rotate: -8, depth: 30, opacity: 1 },
	{ motif: 5, side: 'band', x: 0.78, y: 22, size: 82, rotate: 4, depth: 70, opacity: 1 },
	{ motif: 3, side: 'band', x: 0.92, y: 10, size: 64, rotate: 10, depth: 30, opacity: 1 },
];
