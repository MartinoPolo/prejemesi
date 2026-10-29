import { expect, type TestDetails, type TestType } from '@playwright/test';
import type { Dimensions } from './pairwise.js';
import { surfaceCases, type Surface, type SurfaceCase } from '../inventory.js';

/**
 * An open product bug. The required behavior stays asserted: affected cases skip only the named
 * assertion, and a dedicated case expects exactly that assertion to fail until the bug is fixed.
 */
export interface KnownProductBug<Case> {
	/** The label of the assertion the bug breaks, as passed to `AssertionGuard.check`. */
	assertion: string;
	bug: string;
	/** The tracking issue once one is filed. */
	issue: number | undefined;
	affects: (surfaceCase: Case) => boolean;
}

/** Runs a case's assertions, except those a known bug leaves to its dedicated case. */
export interface AssertionGuard {
	check(assertion: string, assertions: () => Promise<void> | void): Promise<void>;
}

interface ReproducedBug {
	assertion: string;
	/** Marks the running test as expected to fail. */
	expectFailure: () => void;
}

function guardFor(skipped: ReadonlySet<string>, reproduced?: ReproducedBug) {
	const reached = new Set<string>();
	const guard: AssertionGuard = {
		async check(assertion, assertions) {
			if (skipped.has(assertion)) {
				reached.add(assertion);
				return;
			}
			if (assertion !== reproduced?.assertion) {
				await assertions();
				return;
			}
			try {
				await assertions();
			} catch (error) {
				reproduced.expectFailure();
				throw error;
			}
		},
	};
	return { guard, unreached: () => [...skipped].filter((assertion) => !reached.has(assertion)) };
}

/** `interaction → outcome (state values) @category @surface`, one category and one surface tag. */
export function caseTitle<D extends Dimensions, Outcome extends string>(
	surface: Surface<D, Outcome>,
	{ capability, state, outcome }: SurfaceCase<D, Outcome>,
	knownBugAssertion?: string,
): string {
	const stateLabel = Object.entries(state)
		.map(([name, value]) => `${name} ${value}`)
		.join(', ');
	const bugLabel = knownBugAssertion === undefined ? '' : ` [known bug: ${knownBugAssertion}]`;
	return `${capability.interaction} → ${outcome} (${stateLabel})${bugLabel} @${capability.category} ${surface.surfaceTag}`;
}

/** Fails collection when the inventory and the spec's implementations drift apart. */
function expectCompleteCoverage<D extends Dimensions, Outcome extends string>(
	surface: Surface<D, Outcome>,
	cases: readonly SurfaceCase<D, Outcome>[],
	interactions: readonly string[],
) {
	const caseless = surface.capabilities.filter(
		(capability) => !cases.some((surfaceCase) => surfaceCase.capability === capability),
	);
	const offered = new Set(surface.capabilities.map(({ interaction }) => interaction));
	const problems = [
		...caseless.map(({ interaction }) => `"${interaction}" yields no case`),
		...[...offered]
			.filter((interaction) => !interactions.includes(interaction))
			.map((interaction) => `"${interaction}" has no implementation`),
		...interactions
			.filter((interaction) => !offered.has(interaction))
			.map((interaction) => `"${interaction}" is implemented but not in the inventory`),
	];
	if (problems.length > 0) {
		throw new Error(`${surface.name}: ${problems.join('; ')}`);
	}
}

export interface SurfaceSpec<D extends Dimensions, Outcome extends string> {
	surface: Surface<D, Outcome>;
	/** The interaction names the spec implements. */
	interactions: readonly string[];
	knownBugs: readonly KnownProductBug<SurfaceCase<D, Outcome>>[];
	/** Cases with one key share a page and run in order in one worker. */
	groupKey: (surfaceCase: SurfaceCase<D, Outcome>) => string;
	/** Orders the cases inside a group, such as to keep display changes rare. */
	compare?: (first: SurfaceCase<D, Outcome>, second: SurfaceCase<D, Outcome>) => number;
}

/**
 * Calls `test()` from the spec file. Playwright locates a test where `test()` is called, so a call
 * here would report every case of every spec at this file.
 */
export type DeclareTest<World> = (
	title: string,
	details: TestDetails,
	body: (fixtures: { world: World }) => Promise<void>,
) => void;

/** Declares one test per case, plus one expected-to-fail case per known bug that affects it. */
export function describeSurfaceCases<
	D extends Dimensions,
	Outcome extends string,
	TestArgs extends object,
	WorkerArgs extends { world: unknown },
>(
	test: TestType<TestArgs, WorkerArgs>,
	spec: SurfaceSpec<D, Outcome>,
	run: (
		world: WorkerArgs['world'],
		surfaceCase: SurfaceCase<D, Outcome>,
		guard: AssertionGuard,
	) => Promise<void>,
	declareTest: DeclareTest<WorkerArgs['world']>,
): void {
	const cases = surfaceCases(spec.surface);
	expectCompleteCoverage(spec.surface, cases, spec.interactions);
	const groups = new Map<string, SurfaceCase<D, Outcome>[]>();
	for (const surfaceCase of cases) {
		const key = spec.groupKey(surfaceCase);
		groups.set(key, [...(groups.get(key) ?? []), surfaceCase]);
	}

	test.describe(spec.surface.name, () => {
		for (const [groupName, groupedCases] of groups) {
			test.describe(groupName, () => {
				test.describe.configure({ mode: 'default' });

				for (const surfaceCase of [...groupedCases].sort(spec.compare ?? (() => 0))) {
					const requirement = {
						type: 'requirement',
						description: surfaceCase.capability.requirement,
					};
					const knownBugs = spec.knownBugs.filter(({ affects }) => affects(surfaceCase));
					declareTest(
						caseTitle(spec.surface, surfaceCase),
						{ annotation: requirement },
						async ({ world }) => {
							const { guard, unreached } = guardFor(
								new Set(knownBugs.map(({ assertion }) => assertion)),
							);
							await run(world, surfaceCase, guard);
							expect(
								unreached(),
								'every known bug names an assertion of this case',
							).toEqual([]);
						},
					);
					for (const knownBug of knownBugs) {
						const others = knownBugs.filter((other) => other !== knownBug);
						declareTest(
							caseTitle(spec.surface, surfaceCase, knownBug.assertion),
							{
								annotation: [
									requirement,
									{
										type: 'known-bug',
										description:
											knownBug.issue === undefined
												? knownBug.bug
												: `#${knownBug.issue}: ${knownBug.bug}`,
									},
								],
							},
							async ({ world }) => {
								const { guard } = guardFor(
									new Set(others.map(({ assertion }) => assertion)),
									{
										assertion: knownBug.assertion,
										// Only this assertion may fail; any other failure stays red.
										expectFailure: () => test.fail(true, knownBug.bug),
									},
								);
								await run(world, surfaceCase, guard);
								throw new Error(
									`The known bug no longer reproduces; remove it from the spec: ${knownBug.bug}`,
								);
							},
						);
					}
				}
			});
		}
	});
}
