export const DEFAULT_PIXEL_TOLERANCE = 0.5;

/**
 * @template Result
 * @param {(actual: number, message?: string) => {
 *   toBeLessThanOrEqual: (expected: number) => Result,
 *   toBeGreaterThanOrEqual: (expected: number) => Result
 * }} expect
 */
export function createPixelAssertions(expect) {
	return { expectPixelsNear, expectPixelsAtLeast, expectPixelsAtMost };

	/** @param {number} actual @param {number} expected @param {string} [message] @param {number} [tolerance] */
	function expectPixelsNear(actual, expected, message, tolerance = DEFAULT_PIXEL_TOLERANCE) {
		return expect(
			Math.abs(actual - expected),
			message ?? `Expected ${actual}px to be within ${tolerance}px of ${expected}px`,
		).toBeLessThanOrEqual(tolerance);
	}

	/** @param {number} actual @param {number} minimum @param {string} [message] @param {number} [tolerance] */
	function expectPixelsAtLeast(actual, minimum, message, tolerance = DEFAULT_PIXEL_TOLERANCE) {
		return expect(
			actual,
			message ??
				`Expected ${actual}px to be at least ${minimum}px (tolerance ${tolerance}px)`,
		).toBeGreaterThanOrEqual(minimum - tolerance);
	}

	/** @param {number} actual @param {number} maximum @param {string} [message] @param {number} [tolerance] */
	function expectPixelsAtMost(actual, maximum, message, tolerance = DEFAULT_PIXEL_TOLERANCE) {
		return expect(
			actual,
			message ?? `Expected ${actual}px to be at most ${maximum}px (tolerance ${tolerance}px)`,
		).toBeLessThanOrEqual(maximum + tolerance);
	}
}
