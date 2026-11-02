import { describe, expect, it } from 'vitest';
import { composerMaxLines } from './chat_presentation.js';

// Caps from the approved mobile keyboard design (designs/mobile-keyboard/refined.html).
describe('composerMaxLines', () => {
	it.each([
		[584, 4],
		[400, 4],
		[399, 3],
		[320, 3],
		[319, 2],
		[180, 2],
	])('caps the composer at the lines that fit in %ipx above the keyboard', (height, lines) => {
		expect(composerMaxLines(height)).toBe(lines);
	});
});
