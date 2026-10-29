import { describe, expect, it } from 'vitest';
import { resolveCardTarget, resolveReleaseGlide, resolveScrollability } from './scroll_row.js';

describe('resolveScrollability', () => {
	it('allows neither direction when the row fits', () => {
		expect(resolveScrollability(0, 600, 600)).toEqual({
			canScrollPrev: false,
			canScrollNext: false,
		});
	});

	it('allows only Next at the start and only Previous at the end of an overflowing row', () => {
		expect(resolveScrollability(0, 1200, 600)).toEqual({
			canScrollPrev: false,
			canScrollNext: true,
		});
		expect(resolveScrollability(600, 1200, 600)).toEqual({
			canScrollPrev: true,
			canScrollNext: false,
		});
	});

	it('treats sub-pixel offsets from fractional zoom as being at the edge', () => {
		expect(resolveScrollability(599.5, 1200, 600).canScrollNext).toBe(false);
		expect(resolveScrollability(0.5, 1200, 600).canScrollPrev).toBe(false);
	});
});

describe('resolveCardTarget', () => {
	const cardStarts = [0, 300, 600, 900, 1200];

	it('advances to the next card start past the current offset', () => {
		expect(resolveCardTarget(cardStarts, 0, 1000, 1)).toBe(300);
		expect(resolveCardTarget(cardStarts, 300, 1000, 1)).toBe(600);
	});

	it('goes back to the previous card start before the current offset', () => {
		expect(resolveCardTarget(cardStarts, 600, 1000, -1)).toBe(300);
		expect(resolveCardTarget(cardStarts, 400, 1000, -1)).toBe(300);
	});

	it('moves Previous one whole card from a row end whose leading card starts just past it', () => {
		// At offset 890 the card starting at 900 leads the row, so Previous brings the card before it.
		expect(resolveCardTarget(cardStarts, 890, 890, -1)).toBe(600);
	});

	it('clamps to the row edges', () => {
		expect(resolveCardTarget(cardStarts, 950, 1000, 1)).toBe(1000);
		expect(resolveCardTarget(cardStarts, 1000, 1000, 1)).toBe(1000);
		expect(resolveCardTarget(cardStarts, 200, 1000, -1)).toBe(0);
	});
});

describe('resolveReleaseGlide', () => {
	it('keeps gliding in the drag direction after a fast release', () => {
		const samples = [
			{ x: 500, time: 0 },
			{ x: 450, time: 50 },
			{ x: 400, time: 100 },
		];
		expect(resolveReleaseGlide(samples, 105)).toBeGreaterThan(0);
		const reversed = samples.map((sample) => ({ ...sample, x: 1000 - sample.x }));
		expect(resolveReleaseGlide(reversed, 105)).toBeLessThan(0);
	});

	it('glides farther for a faster release', () => {
		const slow = [
			{ x: 500, time: 0 },
			{ x: 480, time: 100 },
		];
		const fast = [
			{ x: 500, time: 0 },
			{ x: 380, time: 100 },
		];
		expect(resolveReleaseGlide(fast, 100)).toBeGreaterThan(resolveReleaseGlide(slow, 100));
	});

	it('does not glide when the pointer paused before release', () => {
		const samples = [
			{ x: 500, time: 0 },
			{ x: 400, time: 100 },
		];
		expect(resolveReleaseGlide(samples, 300)).toBe(0);
	});

	it('ignores movement older than the recent window', () => {
		const samples = [
			{ x: 900, time: 0 },
			{ x: 400, time: 400 },
			{ x: 400, time: 500 },
		];
		expect(resolveReleaseGlide(samples, 500)).toBe(0);
	});
});
