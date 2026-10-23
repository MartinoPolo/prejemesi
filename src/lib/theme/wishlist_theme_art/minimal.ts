import type { MotifPlacement } from './types.js';

export const motifs: readonly string[] = [
	`<path d="M18 92 V50 Q18 16 50 16 Q82 16 82 50 V92Z" fill="var(--m-b)" stroke="var(--m-ink)" stroke-width="2"/>`,
	`<g stroke="var(--m-ink)" stroke-width="2" stroke-linecap="square"><path d="M10 20 H90"/><path d="M10 40 H70"/><path d="M10 60 H90"/><path d="M10 80 H50"/></g>`,
	`<g fill="var(--m-ink)"><circle cx="20" cy="20" r="2.5"/><circle cx="40" cy="20" r="2.5"/><circle cx="60" cy="20" r="2.5"/><circle cx="80" cy="20" r="2.5"/><circle cx="20" cy="40" r="2.5"/><circle cx="40" cy="40" r="2.5"/><circle cx="60" cy="40" r="2.5"/><circle cx="80" cy="40" r="2.5"/><circle cx="20" cy="60" r="2.5"/><circle cx="40" cy="60" r="2.5"/><circle cx="60" cy="60" r="2.5"/><circle cx="80" cy="60" r="2.5"/><circle cx="20" cy="80" r="2.5"/><circle cx="40" cy="80" r="2.5"/><circle cx="60" cy="80" r="2.5"/><circle cx="80" cy="80" r="2.5"/></g>`,
	`<circle cx="50" cy="50" r="34" fill="none" stroke="var(--m-a)" stroke-width="6"/><circle cx="50" cy="50" r="34" fill="none" stroke="var(--m-ink)" stroke-width="1.5"/>`,
	`<path d="M50 14 L88 84 H12Z" fill="var(--m-c)" stroke="var(--m-ink)" stroke-width="2"/>`,
	`<path d="M38 12 H62 V24 Q78 40 74 66 Q70 90 50 90 Q30 90 26 66 Q22 40 38 24Z" fill="var(--m-a)" stroke="var(--m-ink)" stroke-width="2"/><path d="M50 12 Q46 2 40 4 M52 12 Q58 0 66 6" fill="none" stroke="var(--m-ink)" stroke-width="2"/>`,
];

export const placements: readonly MotifPlacement[] = [
	{ motif: 0, side: 'left', x: 0.12, y: 5.6, size: 57, rotate: 7, depth: 40, opacity: 0.75 },
	{ motif: 1, side: 'left', x: 0.64, y: 17.6, size: 78, rotate: -6, depth: 110, opacity: 1 },
	{ motif: 2, side: 'left', x: 0.44, y: 28.9, size: 100, rotate: 12, depth: 190, opacity: 1 },
	{ motif: 0, side: 'left', x: 0.21, y: 38.8, size: 62, rotate: 6, depth: 40, opacity: 0.75 },
	{ motif: 1, side: 'left', x: 0.82, y: 51.8, size: 94, rotate: -1, depth: 110, opacity: 1 },
	{ motif: 2, side: 'left', x: 0.62, y: 62, size: 103, rotate: -1, depth: 190, opacity: 1 },
	{ motif: 0, side: 'left', x: 0.66, y: 76, size: 59, rotate: 11, depth: 40, opacity: 0.75 },
	{ motif: 1, side: 'left', x: 0.82, y: 88.6, size: 95, rotate: 4, depth: 110, opacity: 1 },
	{ motif: 3, side: 'right', x: 0.2, y: 4, size: 93, rotate: -4, depth: 110, opacity: 1 },
	{ motif: 4, side: 'right', x: 0.79, y: 17.1, size: 104, rotate: 0, depth: 190, opacity: 1 },
	{ motif: 5, side: 'right', x: 0.28, y: 30.8, size: 54, rotate: 9, depth: 40, opacity: 0.75 },
	{ motif: 3, side: 'right', x: 0.37, y: 41.8, size: 93, rotate: 9, depth: 110, opacity: 1 },
	{ motif: 4, side: 'right', x: 0.62, y: 52.7, size: 120, rotate: -4, depth: 190, opacity: 1 },
	{ motif: 5, side: 'right', x: 0.75, y: 65.6, size: 61, rotate: -16, depth: 40, opacity: 0.75 },
	{ motif: 3, side: 'right', x: 0.14, y: 77.2, size: 89, rotate: 10, depth: 110, opacity: 1 },
	{ motif: 4, side: 'right', x: 0.72, y: 91.5, size: 111, rotate: -14, depth: 190, opacity: 1 },
	{ motif: 0, side: 'band', x: 0.09, y: 8.5, size: 67, rotate: 3, depth: 30, opacity: 1 },
	{ motif: 3, side: 'band', x: 0.2, y: 12.3, size: 68, rotate: -4, depth: 70, opacity: 1 },
	{ motif: 1, side: 'band', x: 0.35, y: 9.6, size: 74, rotate: 12, depth: 30, opacity: 1 },
	{ motif: 4, side: 'band', x: 0.52, y: 16, size: 85, rotate: 10, depth: 70, opacity: 1 },
	{ motif: 2, side: 'band', x: 0.64, y: 5.3, size: 66, rotate: -6, depth: 30, opacity: 1 },
	{ motif: 5, side: 'band', x: 0.77, y: 16.8, size: 84, rotate: 8, depth: 70, opacity: 1 },
	{ motif: 0, side: 'band', x: 0.94, y: 23.9, size: 83, rotate: 4, depth: 30, opacity: 1 },
];
