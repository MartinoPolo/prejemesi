import { INK_OUTLINE } from './outline.js';
import type { MotifPlacement } from './types.js';

export const motifs: readonly string[] = [
	`<path d="M24 30 H76 Q92 30 94 52 Q96 76 82 78 Q72 78 66 64 H34 Q28 78 18 78 Q4 76 6 52 Q8 30 24 30Z" fill="var(--m-a)" ${INK_OUTLINE}/><path d="M26 44 V58 M19 51 H33" stroke="var(--m-paper)" stroke-width="5" stroke-linecap="round"/><circle cx="70" cy="46" r="4.5" fill="var(--m-b)" stroke="var(--m-ink)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="80" cy="54" r="4.5" fill="var(--m-c)" stroke="var(--m-ink)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`,
	`<path d="M20 60 V48 Q20 18 50 18 Q80 18 80 48 V60" fill="none" stroke="var(--m-ink)" stroke-width="8" stroke-linecap="round"/><path d="M20 60 V48 Q20 18 50 18 Q80 18 80 48 V60" fill="none" stroke="var(--m-c)" stroke-width="3.5" stroke-linecap="round"/><rect x="10" y="52" width="22" height="34" rx="9" fill="var(--m-a)" ${INK_OUTLINE}/><rect x="68" y="52" width="22" height="34" rx="9" fill="var(--m-a)" ${INK_OUTLINE}/>`,
	`<rect x="16" y="62" width="68" height="24" rx="6" fill="var(--m-a)" ${INK_OUTLINE}/><rect x="46" y="30" width="8" height="34" fill="var(--m-paper)" ${INK_OUTLINE}/><circle cx="50" cy="26" r="13" fill="var(--m-b)" ${INK_OUTLINE}/><circle cx="72" cy="74" r="5" fill="var(--m-c)" stroke="var(--m-ink)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`,
	`<g fill="var(--m-b)" stroke="var(--m-ink)" stroke-width="1.5"><rect x="20" y="24" width="12" height="12"/><rect x="32" y="24" width="12" height="12"/><rect x="56" y="24" width="12" height="12"/><rect x="68" y="24" width="12" height="12"/><rect x="8" y="36" width="12" height="12"/><rect x="20" y="36" width="12" height="12"/><rect x="32" y="36" width="12" height="12"/><rect x="44" y="36" width="12" height="12"/><rect x="56" y="36" width="12" height="12"/><rect x="68" y="36" width="12" height="12"/><rect x="80" y="36" width="12" height="12"/><rect x="20" y="48" width="12" height="12"/><rect x="32" y="48" width="12" height="12"/><rect x="44" y="48" width="12" height="12"/><rect x="56" y="48" width="12" height="12"/><rect x="68" y="48" width="12" height="12"/><rect x="32" y="60" width="12" height="12"/><rect x="44" y="60" width="12" height="12"/><rect x="56" y="60" width="12" height="12"/><rect x="44" y="72" width="12" height="12"/></g><rect x="24" y="40" width="6" height="6" fill="var(--m-paper)"/>`,
	`<g fill="var(--m-d)" stroke="var(--m-ink)" stroke-width="1.5"><rect x="42" y="10" width="16" height="16"/><rect x="42" y="26" width="16" height="16"/><rect x="10" y="42" width="16" height="16"/><rect x="26" y="42" width="16" height="16"/><rect x="42" y="42" width="16" height="16"/><rect x="58" y="42" width="16" height="16"/><rect x="74" y="42" width="16" height="16"/><rect x="42" y="58" width="16" height="16"/><rect x="42" y="74" width="16" height="16"/></g>`,
	`<rect x="6" y="30" width="88" height="42" rx="6" fill="var(--m-a)" ${INK_OUTLINE}/><g fill="var(--m-paper)" stroke="var(--m-ink)" stroke-width="1.5"><rect x="13" y="37" width="10" height="9" rx="2"/><rect x="26" y="37" width="10" height="9" rx="2"/><rect x="39" y="37" width="10" height="9" rx="2"/><rect x="52" y="37" width="10" height="9" rx="2"/><rect x="65" y="37" width="10" height="9" rx="2"/><rect x="78" y="37" width="10" height="9" rx="2"/><rect x="13" y="50" width="10" height="9" rx="2"/><rect x="26" y="50" width="49" height="9" rx="2"/><rect x="78" y="50" width="10" height="9" rx="2"/></g><rect x="28" y="62" width="44" height="5" rx="2" fill="var(--m-b)"/>`,
];

export const placements: readonly MotifPlacement[] = [
	{ motif: 0, side: 'left', x: 0.67, y: 5.1, size: 51, rotate: 0, depth: 40, opacity: 0.75 },
	{ motif: 1, side: 'left', x: 0.17, y: 17.8, size: 84, rotate: 4, depth: 110, opacity: 1 },
	{ motif: 2, side: 'left', x: 0.56, y: 28.1, size: 122, rotate: -4, depth: 190, opacity: 1 },
	{ motif: 0, side: 'left', x: 0.2, y: 39.4, size: 55, rotate: 9, depth: 40, opacity: 0.75 },
	{ motif: 1, side: 'left', x: 0.57, y: 51.2, size: 94, rotate: 17, depth: 110, opacity: 1 },
	{ motif: 2, side: 'left', x: 0.46, y: 65.7, size: 105, rotate: 13, depth: 190, opacity: 1 },
	{ motif: 0, side: 'left', x: 0.28, y: 77.3, size: 57, rotate: 15, depth: 40, opacity: 0.75 },
	{ motif: 1, side: 'left', x: 0.28, y: 87, size: 81, rotate: 1, depth: 110, opacity: 1 },
	{ motif: 3, side: 'right', x: 0.86, y: 4.4, size: 84, rotate: 4, depth: 110, opacity: 1 },
	{ motif: 4, side: 'right', x: 0.81, y: 18.7, size: 104, rotate: 2, depth: 190, opacity: 1 },
	{ motif: 5, side: 'right', x: 0.58, y: 26.3, size: 50, rotate: -5, depth: 40, opacity: 0.75 },
	{ motif: 3, side: 'right', x: 0.2, y: 41.3, size: 95, rotate: -5, depth: 110, opacity: 1 },
	{ motif: 4, side: 'right', x: 0.6, y: 55.6, size: 106, rotate: 1, depth: 190, opacity: 1 },
	{ motif: 5, side: 'right', x: 0.22, y: 65.4, size: 60, rotate: 10, depth: 40, opacity: 0.75 },
	{ motif: 3, side: 'right', x: 0.48, y: 77.2, size: 80, rotate: 4, depth: 110, opacity: 1 },
	{ motif: 4, side: 'right', x: 0.87, y: 90, size: 104, rotate: -10, depth: 190, opacity: 1 },
	{ motif: 0, side: 'band', x: 0.1, y: 22.2, size: 73, rotate: 12, depth: 30, opacity: 1 },
	{ motif: 3, side: 'band', x: 0.23, y: 19.6, size: 65, rotate: -11, depth: 70, opacity: 1 },
	{ motif: 1, side: 'band', x: 0.36, y: 19, size: 68, rotate: 10, depth: 30, opacity: 1 },
	{ motif: 4, side: 'band', x: 0.49, y: 18.3, size: 76, rotate: 10, depth: 70, opacity: 1 },
	{ motif: 2, side: 'band', x: 0.62, y: 15.5, size: 73, rotate: 10, depth: 30, opacity: 1 },
	{ motif: 5, side: 'band', x: 0.81, y: 17.4, size: 84, rotate: -7, depth: 70, opacity: 1 },
	{ motif: 0, side: 'band', x: 0.95, y: 22.9, size: 66, rotate: 1, depth: 30, opacity: 1 },
];
