/** Named test dimensions, each with its possible values. */
export type Dimensions = Readonly<Record<string, readonly string[]>>;

/** One value chosen for every dimension. */
export type Combination<D extends Dimensions> = { [Name in keyof D]: D[Name][number] };

/** Every combination, in dimension order, that `isPossible` accepts. */
export function allCombinations<D extends Dimensions>(
	dimensions: D,
	isPossible: (combination: Combination<D>) => boolean = () => true,
): Combination<D>[] {
	let combinations: Record<string, string>[] = [{}];
	for (const [name, values] of Object.entries(dimensions)) {
		combinations = combinations.flatMap((partial) =>
			values.map((value) => ({ ...partial, [name]: value })),
		);
	}
	return (combinations as Combination<D>[]).filter(isPossible);
}

function pairKeys(combination: Record<string, string>): string[] {
	const entries = Object.entries(combination);
	return entries.flatMap(([firstName, firstValue], index) =>
		entries
			.slice(index + 1)
			.map(
				([secondName, secondValue]) =>
					`${firstName}=${firstValue}|${secondName}=${secondValue}`,
			),
	);
}

/**
 * A small deterministic set of possible combinations that covers every value pair occurring in
 * any possible combination. Greedy: repeatedly takes the first combination covering the most
 * uncovered pairs. It enumerates the full product, which suits the few short dimensions of UI
 * states.
 */
export function allPairs<D extends Dimensions>(
	dimensions: D,
	isPossible: (combination: Combination<D>) => boolean = () => true,
): Combination<D>[] {
	const possible = allCombinations(dimensions, isPossible);
	if (Object.keys(dimensions).length < 2) {
		return possible;
	}
	const candidates = possible.map((combination) => ({
		combination,
		pairs: pairKeys(combination),
	}));
	const uncovered = new Set(candidates.flatMap((candidate) => candidate.pairs));
	const chosen: Combination<D>[] = [];
	while (uncovered.size > 0) {
		let best = candidates[0]!;
		let bestGain = -1;
		for (const candidate of candidates) {
			const gain = candidate.pairs.filter((pair) => uncovered.has(pair)).length;
			if (gain > bestGain) {
				best = candidate;
				bestGain = gain;
			}
		}
		chosen.push(best.combination);
		for (const pair of best.pairs) {
			uncovered.delete(pair);
		}
	}
	return chosen;
}
