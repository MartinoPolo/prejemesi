import { expect, type ElementHandle, type Locator, type Page } from '@playwright/test';

const TRANSITION_RECORDER_PROPERTY = '__prejemesiTestTransitionRecorder';
const EXIT_OPACITY_TOLERANCE = 0.08;

const SAMPLE_SOURCES = [
	'initial',
	'animation-start',
	'animation-end',
	'animation-finished',
	'state-change',
	'animation-frame',
	'detached',
	'observation-finished',
] as const;

type TransitionSampleSource = (typeof SAMPLE_SOURCES)[number];

function isTransitionSampleSource(value: unknown): value is TransitionSampleSource {
	return typeof value === 'string' && SAMPLE_SOURCES.some((source) => source === value);
}

export interface TransitionAnimationMetadata {
	duration: number;
	opacityKeyframes: number[];
}

export interface TransitionSample {
	time: number;
	connected: boolean;
	state: string | null;
	opacity: number;
	pointerEvents: string;
	runningAnimations: number;
	source: TransitionSampleSource;
	animations: TransitionAnimationMetadata[];
}

function isTransitionAnimationMetadata(value: unknown): value is TransitionAnimationMetadata {
	return (
		typeof value === 'object' &&
		value !== null &&
		'duration' in value &&
		typeof value.duration === 'number' &&
		Number.isFinite(value.duration) &&
		'opacityKeyframes' in value &&
		Array.isArray(value.opacityKeyframes) &&
		value.opacityKeyframes.every(
			(opacity): opacity is number => typeof opacity === 'number' && Number.isFinite(opacity),
		)
	);
}

function isTransitionSample(value: unknown): value is TransitionSample {
	return (
		typeof value === 'object' &&
		value !== null &&
		'time' in value &&
		typeof value.time === 'number' &&
		Number.isFinite(value.time) &&
		'connected' in value &&
		typeof value.connected === 'boolean' &&
		'state' in value &&
		(typeof value.state === 'string' || value.state === null) &&
		'opacity' in value &&
		typeof value.opacity === 'number' &&
		Number.isFinite(value.opacity) &&
		'pointerEvents' in value &&
		typeof value.pointerEvents === 'string' &&
		'runningAnimations' in value &&
		typeof value.runningAnimations === 'number' &&
		'source' in value &&
		isTransitionSampleSource(value.source) &&
		'animations' in value &&
		Array.isArray(value.animations) &&
		value.animations.every(isTransitionAnimationMetadata)
	);
}

function parseRecordedSamples(value: unknown): TransitionSample[] {
	if (!Array.isArray(value) || !value.every(isTransitionSample)) {
		throw new Error('Transition recorder produced malformed samples');
	}
	return value;
}

export async function waitForSurfaceMotionToSettle(surface: Locator): Promise<void> {
	await expect(surface).toBeVisible();
	await expect
		.poll(() =>
			surface.evaluate(
				(element) =>
					element.getAnimations().filter((animation) => animation.playState === 'running')
						.length,
			),
		)
		.toBe(0);
}

export async function startTransitionObservation(
	surface: Locator,
): Promise<ElementHandle<HTMLElement | SVGElement>> {
	const surfaceHandle = await surface.elementHandle();
	if (surfaceHandle === null) {
		throw new Error('Cannot observe a surface that is not attached');
	}

	await surfaceHandle.evaluate((element, recorderProperty) => {
		type SampleSource =
			| 'initial'
			| 'animation-start'
			| 'animation-end'
			| 'animation-finished'
			| 'state-change'
			| 'animation-frame'
			| 'detached'
			| 'observation-finished';
		interface Sample {
			time: number;
			connected: boolean;
			state: string | null;
			opacity: number;
			pointerEvents: string;
			runningAnimations: number;
			source: SampleSource;
			animations: Array<{ duration: number; opacityKeyframes: number[] }>;
		}

		const samples: Sample[] = [];
		const trackedAnimations = new WeakSet<Animation>();
		let stopped = false;
		let animationFrameRequest = 0;

		function animationsForElement(): Animation[] {
			return element.getAnimations().filter((animation) => {
				const effect = animation.effect;
				return effect !== null && 'target' in effect && effect.target === element;
			});
		}

		function animationMetadata(animations: readonly Animation[]) {
			return animations.map((animation) => {
				const duration = animation.effect?.getComputedTiming().duration;
				const keyframes =
					animation.effect instanceof KeyframeEffect
						? animation.effect.getKeyframes()
						: [];
				return {
					duration: typeof duration === 'number' ? duration : Number.NaN,
					opacityKeyframes: keyframes
						.map((keyframe) => Number.parseFloat(String(keyframe.opacity ?? '')))
						.filter((opacity) => Number.isFinite(opacity)),
				};
			});
		}

		function trackAnimationCompletion(animations: readonly Animation[]) {
			for (const animation of animations) {
				if (trackedAnimations.has(animation)) {
					continue;
				}
				trackedAnimations.add(animation);
				void animation.finished.then(
					() => {
						if (!stopped && element.isConnected) {
							record('animation-finished');
						}
					},
					() => undefined,
				);
			}
		}

		function record(source: SampleSource) {
			if (stopped) {
				return;
			}
			const style = getComputedStyle(element);
			const animations = animationsForElement();
			trackAnimationCompletion(animations);
			samples.push({
				time: performance.now(),
				connected: element.isConnected,
				state: element.getAttribute('data-state'),
				opacity: Number.parseFloat(style.opacity || '0'),
				pointerEvents: style.pointerEvents,
				runningAnimations: animations.filter(
					(animation) => animation.playState === 'running',
				).length,
				source,
				animations: animationMetadata(animations),
			});
		}

		function stop(source: 'detached' | 'observation-finished') {
			if (stopped) {
				return;
			}
			record(source);
			stopped = true;
			observer.disconnect();
			element.removeEventListener('animationstart', handleAnimationStart);
			element.removeEventListener('animationend', handleAnimationEnd);
			cancelAnimationFrame(animationFrameRequest);
			recorder.terminal = true;
		}

		function handleAnimationStart(event: Event) {
			if (event.target === element) {
				record('animation-start');
			}
		}

		function handleAnimationEnd(event: Event) {
			if (event.target === element) {
				record('animation-end');
			}
		}

		const observer = new MutationObserver((mutations) => {
			if (!element.isConnected) {
				stop('detached');
				return;
			}
			if (
				mutations.some(
					(mutation) => mutation.type === 'attributes' && mutation.target === element,
				)
			) {
				record('state-change');
			}
		});
		const recorder = {
			samples,
			terminal: false,
			finish: () => stop('observation-finished'),
		};
		Reflect.set(element, recorderProperty, recorder);

		element.addEventListener('animationstart', handleAnimationStart);
		element.addEventListener('animationend', handleAnimationEnd);
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['data-state'],
			childList: true,
			subtree: true,
		});

		function sampleAnimationFrame() {
			record('animation-frame');
			if (!stopped) {
				animationFrameRequest = requestAnimationFrame(sampleAnimationFrame);
			}
		}

		record('initial');
		animationFrameRequest = requestAnimationFrame(sampleAnimationFrame);
	}, TRANSITION_RECORDER_PROPERTY);

	return surfaceHandle;
}

export async function finishTransitionObservation(
	page: Page,
	surfaceHandle: ElementHandle<HTMLElement | SVGElement>,
	options: { expectDetached?: boolean } = {},
): Promise<TransitionSample[]> {
	const expectDetached = options.expectDetached ?? true;
	if (expectDetached) {
		await expect
			.poll(() =>
				surfaceHandle.evaluate((element, recorderProperty) => {
					const recorder: unknown = Reflect.get(element, recorderProperty);
					return (
						typeof recorder === 'object' &&
						recorder !== null &&
						'terminal' in recorder &&
						recorder.terminal === true
					);
				}, TRANSITION_RECORDER_PROPERTY),
			)
			.toBe(true);
	} else {
		await surfaceHandle.evaluate((element, recorderProperty) => {
			const recorder: unknown = Reflect.get(element, recorderProperty);
			if (
				typeof recorder === 'object' &&
				recorder !== null &&
				'finish' in recorder &&
				typeof recorder.finish === 'function'
			) {
				recorder.finish();
			}
		}, TRANSITION_RECORDER_PROPERTY);
	}

	const recordedSamples: unknown = await surfaceHandle.evaluate((element, recorderProperty) => {
		const recorder: unknown = Reflect.get(element, recorderProperty);
		if (typeof recorder !== 'object' || recorder === null || !('samples' in recorder)) {
			return null;
		}
		return recorder.samples;
	}, TRANSITION_RECORDER_PROPERTY);
	return parseRecordedSamples(recordedSamples);
}

export function expectSmoothNonInteractiveExit(
	samples: readonly TransitionSample[],
	options: { requireVisibleTransition: boolean },
): void {
	const firstClosedIndex = samples.findIndex(
		(sample) => sample.connected && sample.state === 'closed',
	);
	expect(
		firstClosedIndex,
		'surface entered its closed state before detaching',
	).toBeGreaterThanOrEqual(0);

	const closingSamples = samples
		.slice(firstClosedIndex)
		.filter((sample) => sample.connected && sample.state === 'closed');
	expect(closingSamples.length, 'closed surface was sampled before detaching').toBeGreaterThan(0);
	expect(
		closingSamples.every((sample) => sample.pointerEvents === 'none'),
		'a closing surface cannot remain interactive',
	).toBe(true);
	expect(
		samples
			.slice(firstClosedIndex)
			.every((sample) => !sample.connected || sample.state !== 'open'),
		'a closing surface never reopens',
	).toBe(true);
	expect(samples.at(-1)?.connected, 'the observer sees the surface detach').toBe(false);

	let lowestOpacity = 1;
	for (const sample of closingSamples) {
		expect(
			sample.opacity,
			`opacity ${sample.opacity} must not rebound after reaching ${lowestOpacity}`,
		).toBeLessThanOrEqual(lowestOpacity + EXIT_OPACITY_TOLERANCE);
		lowestOpacity = Math.min(lowestOpacity, sample.opacity);
	}

	if (options.requireVisibleTransition) {
		const opacityExitAnimations = closingSamples
			.flatMap((sample) => sample.animations)
			.filter(
				(animation) =>
					animation.duration > 0 &&
					Number.isFinite(animation.duration) &&
					animation.opacityKeyframes.length >= 2 &&
					Math.max(...animation.opacityKeyframes) > 0.9 &&
					Math.min(...animation.opacityKeyframes) < 0.1,
			);
		expect(
			opacityExitAnimations.length,
			'normal motion runs a positive-duration opacity exit animation',
		).toBeGreaterThan(0);
		expect(lowestOpacity, 'closing reaches its transparent final state').toBeLessThanOrEqual(
			0.12,
		);
		expect(
			closingSamples.at(-1)?.opacity,
			'closing keeps its transparent final state until detach',
		).toBeLessThanOrEqual(0.12);
	}
}

export function expectDirectUnmountWithoutFlash(samples: readonly TransitionSample[]): void {
	const attachedSamples = samples.filter((sample) => sample.connected);
	expect(attachedSamples.length).toBeGreaterThan(0);
	expect(
		attachedSamples.every((sample) => sample.state !== 'closed'),
		'the conditionally rendered mobile sheet directly unmounts',
	).toBe(true);
	expect(
		attachedSamples.every((sample) => sample.opacity > 0.9),
		'the sheet never flashes transparent before direct unmount',
	).toBe(true);
	expect(samples.at(-1)?.connected, 'the observer sees the sheet detach').toBe(false);
}

export function expectReducedMotionDirectExit(samples: readonly TransitionSample[]): void {
	const detachedIndex = samples.findIndex((sample) => !sample.connected);
	expect(detachedIndex, 'the reduced-motion observer sees the surface detach').toBeGreaterThan(0);

	const attachedSamples = samples.slice(0, detachedIndex);
	expect(
		attachedSamples.every(
			(sample) => sample.runningAnimations === 0 && sample.animations.length === 0,
		),
		'reduced motion does not run an exit animation',
	).toBe(true);
	const firstClosedIndex = attachedSamples.findIndex((sample) => sample.state === 'closed');
	const closingSamples = firstClosedIndex >= 0 ? attachedSamples.slice(firstClosedIndex) : [];
	expect(
		closingSamples.every((sample) => sample.pointerEvents === 'none'),
		'a reduced-motion closing surface is never interactive',
	).toBe(true);
	expect(
		closingSamples.every((sample) => sample.state !== 'open'),
		'a reduced-motion closing surface never reopens',
	).toBe(true);
	let lowestOpacity = 1;
	for (const sample of closingSamples) {
		expect(
			sample.opacity,
			`reduced-motion opacity ${sample.opacity} must not rebound after reaching ${lowestOpacity}`,
		).toBeLessThanOrEqual(lowestOpacity + EXIT_OPACITY_TOLERANCE);
		lowestOpacity = Math.min(lowestOpacity, sample.opacity);
	}
	const closingAnimationFrames = closingSamples.filter(
		(sample) => sample.source === 'animation-frame',
	);
	expect(
		closingAnimationFrames.length,
		'reduced-motion teardown removes the surface within its closing frames',
	).toBeLessThanOrEqual(2);
}

export async function expectModalCleanup(
	page: Page,
	restoreTarget: Locator,
	options: { requireRestoredFocus?: boolean } = {},
): Promise<void> {
	await expect(
		page.locator('[data-slot="dialog-overlay"], [data-slot="sheet-overlay"]'),
	).toHaveCount(0);
	if (options.requireRestoredFocus !== false) {
		await expect(restoreTarget).toBeFocused();
	} else {
		expect(
			await page.evaluate(
				() =>
					document.activeElement?.isConnected === true &&
					document.activeElement.closest('[data-slot="dialog-content"]') === null,
			),
			'focus is not stranded in a detached or closed dialog',
		).toBe(true);
	}
	expect(
		await page.locator('body').evaluate((body) => ({
			pointerEvents: getComputedStyle(body).pointerEvents,
			overflow: getComputedStyle(body).overflow,
			scrollLocked: body.hasAttribute('data-scroll-locked'),
		})),
	).toEqual({ pointerEvents: 'auto', overflow: 'visible', scrollLocked: false });
}
