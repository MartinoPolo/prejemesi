/**
 * Exhaustiveness guard for manually-maintained variant arrays.
 *
 * Use this when you need a fixed-order or semantically-split subset of a
 * tv() variant union (e.g. BUTTON_TEXT_SIZES vs BUTTON_ICON_SIZES).
 * For full-coverage arrays that need no manual ordering, prefer Object.keys().
 *
 * Produces a compile error naming exactly which union members are absent:
 *   `Missing variant(s): <name>`
 *
 * Usage:
 *   type MyVariant = keyof typeof myTvConfig.variants.variant;
 *   const MY_VARIANTS = asExhaustiveArray<MyVariant>()(['a', 'b', 'c']);
 */
export const asExhaustiveArray =
	<U extends string>() =>
	<const T extends U>(
		arr: [Exclude<U, T>] extends [never]
			? readonly T[]
			: `Missing variant(s): ${Exclude<U, T> & string}`,
	): readonly T[] =>
		arr as readonly T[];
