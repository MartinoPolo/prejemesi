import { INK_OUTLINE } from './outline.js';
import type { MotifPlacement } from './types.js';

export const motifs: readonly string[] = [
	`<g stroke="var(--m-ink)" stroke-width="2.5"><path d="M50 80 L4 80" /><path d="M50 80 L10.162831425915819 57" /><path d="M50 80 L26.99999999999999 40.162831425915826" /><path d="M50 80 L50 34" /><path d="M50 80 L73 40.16283142591582" /><path d="M50 80 L89.83716857408419 57.00000000000001" /><path d="M50 80 L96 80" /></g><path d="M14 80 A36 36 0 0 1 86 80Z" fill="var(--m-a)" ${INK_OUTLINE}/><path d="M30 80 A20 20 0 0 1 70 80Z" fill="var(--m-b)" ${INK_OUTLINE}/>`,
	`<g fill="var(--m-paper)" stroke="var(--m-ink)" stroke-width="2.5"><ellipse cx="50" cy="24" rx="9" ry="18" transform="rotate(0 50 50)"/><ellipse cx="50" cy="24" rx="9" ry="18" transform="rotate(45 50 50)"/><ellipse cx="50" cy="24" rx="9" ry="18" transform="rotate(90 50 50)"/><ellipse cx="50" cy="24" rx="9" ry="18" transform="rotate(135 50 50)"/><ellipse cx="50" cy="24" rx="9" ry="18" transform="rotate(180 50 50)"/><ellipse cx="50" cy="24" rx="9" ry="18" transform="rotate(225 50 50)"/><ellipse cx="50" cy="24" rx="9" ry="18" transform="rotate(270 50 50)"/><ellipse cx="50" cy="24" rx="9" ry="18" transform="rotate(315 50 50)"/></g><circle cx="50" cy="50" r="13" fill="var(--m-b)" ${INK_OUTLINE}/>`,
	`<rect x="8" y="22" width="84" height="56" rx="6" fill="var(--m-a)" ${INK_OUTLINE}/><rect x="18" y="30" width="64" height="22" rx="4" fill="var(--m-paper)" stroke="var(--m-ink)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="34" cy="41" r="6" fill="var(--m-b)" stroke="var(--m-ink)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="66" cy="41" r="6" fill="var(--m-b)" stroke="var(--m-ink)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M24 78 L30 62 H70 L76 78" fill="var(--m-c)" stroke="var(--m-ink)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`,
	`<path d="M8 82 A42 42 0 0 1 92 82" fill="none" stroke="var(--m-a)" stroke-width="10"/><path d="M20 82 A30 30 0 0 1 80 82" fill="none" stroke="var(--m-b)" stroke-width="10"/><path d="M32 82 A18 18 0 0 1 68 82" fill="none" stroke="var(--m-c)" stroke-width="10"/><path d="M3 82 A47 47 0 0 1 97 82 M37 82 A13 13 0 0 1 63 82" fill="none" stroke="var(--m-ink)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`,
	`<circle cx="50" cy="50" r="40" fill="var(--m-ink)"/><circle cx="50" cy="50" r="32" fill="none" stroke="var(--m-paper)" stroke-opacity=".25" stroke-width="1.5"/><circle cx="50" cy="50" r="24" fill="none" stroke="var(--m-paper)" stroke-opacity=".25" stroke-width="1.5"/><circle cx="50" cy="50" r="13" fill="var(--m-a)"/><circle cx="50" cy="50" r="3" fill="var(--m-paper)"/>`,
];

export const placements: readonly MotifPlacement[] = [
	{ motif: 0, side: 'left', x: 0.69, y: 6.6, size: 63, rotate: -5, depth: 40, opacity: 0.75 },
	{ motif: 1, side: 'left', x: 0.7, y: 17.9, size: 83, rotate: -17, depth: 110, opacity: 1 },
	{ motif: 2, side: 'left', x: 0.34, y: 29.8, size: 103, rotate: -17, depth: 190, opacity: 1 },
	{ motif: 0, side: 'left', x: 0.42, y: 38.2, size: 52, rotate: -6, depth: 40, opacity: 0.75 },
	{ motif: 1, side: 'left', x: 0.65, y: 54.5, size: 82, rotate: 6, depth: 110, opacity: 1 },
	{ motif: 2, side: 'left', x: 0.68, y: 66.9, size: 114, rotate: 1, depth: 190, opacity: 1 },
	{ motif: 0, side: 'left', x: 0.78, y: 78, size: 59, rotate: -1, depth: 40, opacity: 0.75 },
	{ motif: 1, side: 'left', x: 0.45, y: 87.6, size: 91, rotate: 15, depth: 110, opacity: 1 },
	{ motif: 3, side: 'right', x: 0.14, y: 6.6, size: 85, rotate: 7, depth: 110, opacity: 1 },
	{ motif: 4, side: 'right', x: 0.65, y: 19, size: 114, rotate: -7, depth: 190, opacity: 1 },
	{ motif: 1, side: 'right', x: 0.56, y: 30.9, size: 50, rotate: -16, depth: 40, opacity: 0.75 },
	{ motif: 3, side: 'right', x: 0.16, y: 42.3, size: 88, rotate: 0, depth: 110, opacity: 1 },
	{ motif: 4, side: 'right', x: 0.57, y: 50.5, size: 121, rotate: -16, depth: 190, opacity: 1 },
	{ motif: 1, side: 'right', x: 0.22, y: 66.7, size: 51, rotate: 6, depth: 40, opacity: 0.75 },
	{ motif: 3, side: 'right', x: 0.62, y: 77.9, size: 96, rotate: 12, depth: 110, opacity: 1 },
	{ motif: 4, side: 'right', x: 0.88, y: 87.1, size: 122, rotate: 3, depth: 190, opacity: 1 },
	{ motif: 0, side: 'band', x: 0.07, y: 16.9, size: 78, rotate: -3, depth: 30, opacity: 1 },
	{ motif: 3, side: 'band', x: 0.22, y: 25.1, size: 68, rotate: 1, depth: 70, opacity: 1 },
	{ motif: 1, side: 'band', x: 0.36, y: 16.8, size: 81, rotate: -11, depth: 30, opacity: 1 },
	{ motif: 4, side: 'band', x: 0.51, y: 12.8, size: 72, rotate: -12, depth: 70, opacity: 1 },
	{ motif: 2, side: 'band', x: 0.64, y: 7.3, size: 68, rotate: -8, depth: 30, opacity: 1 },
	{ motif: 1, side: 'band', x: 0.78, y: 22.2, size: 84, rotate: -8, depth: 70, opacity: 1 },
	{ motif: 0, side: 'band', x: 0.94, y: 25.4, size: 80, rotate: -14, depth: 30, opacity: 1 },
];
