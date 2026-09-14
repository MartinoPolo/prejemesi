import { expect, type ElementHandle, type Locator, type Page } from '@playwright/test';

const RECORDED_SAMPLES_ATTRIBUTE = 'data-test-transition-samples';
const EXIT_OPACITY_TOLERANCE = 0.08;

export interface TransitionSample {
	time: number;
	connected: boolean;
	state: string | null;
	opacity: number;
	pointerEvents: string;
	runningAnimations: number;
}

function isTransitionSample(value: unknown): value is TransitionSample {
	return (
		typeof value === 'object' &&
		value !== null &&
		'time' in value &&
		typeof value.time === 'number' &&
		'connected' in value &&
		typeof value.connected === 'boolean' &&
		'state' in value &&
		(typeof value.state === 'string' || value.state === null) &&
		'opacity' in value &&
		typeof value.opacity === 'number' &&
		'pointerEvents' in value &&
		typeof value.pointerEvents === 'string' &&
		'runningAnimations' in value &&
		typeof value.runningAnimations === 'number'
	);
}

function parseRecordedSamples(serializedSamples: string | null): TransitionSample[] {
	if (serializedSamples === null) {
		throw new Error('Transition recorder did not produce samples');
	}
	const parsedSamples: unknown = JSON.parse(serializedSamples);
	if (!Array.isArray(parsedSamples) || !parsedSamples.every(isTransitionSample)) {
		throw new Error('Transition recorder produced malformed samples');
	}
	return parsedSamples;
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

	await surfaceHandle.evaluate((element, samplesAttribute) => {
		const samples: Array<{
			time: number;
			connected: boolean;
			state: string | null;
			opacity: number;
			pointerEvents: string;
			runningAnimations: number;
		}> = [];

		function recordFrame() {
			const style = getComputedStyle(element);
			samples.push({
				time: performance.now(),
				connected: element.isConnected,
				state: element.getAttribute('data-state'),
				opacity: Number.parseFloat(style.opacity || '0'),
				pointerEvents: style.pointerEvents,
				runningAnimations: element
					.getAnimations()
					.filter((animation) => animation.playState === 'running').length,
			});
			element.setAttribute(samplesAttribute, JSON.stringify(samples));
			if (element.isConnected) {
				requestAnimationFrame(recordFrame);
			}
		}

		recordFrame();
	}, RECORDED_SAMPLES_ATTRIBUTE);

	return surfaceHandle;
}

export async function finishTransitionObservation(
	page: Page,
	surfaceHandle: ElementHandle<HTMLElement | SVGElement>,
): Promise<TransitionSample[]> {
	await page.waitForTimeout(50);
	return parseRecordedSamples(await surfaceHandle.getAttribute(RECORDED_SAMPLES_ATTRIBUTE));
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

	let lowestOpacity = 1;
	for (const sample of closingSamples) {
		expect(
			sample.opacity,
			`opacity ${sample.opacity} must not rebound after reaching ${lowestOpacity}`,
		).toBeLessThanOrEqual(lowestOpacity + EXIT_OPACITY_TOLERANCE);
		lowestOpacity = Math.min(lowestOpacity, sample.opacity);
	}

	if (options.requireVisibleTransition) {
		expect(
			closingSamples.some((sample) => sample.opacity > 0.1 && sample.opacity < 0.9),
			'normal motion samples the visible closing transition',
		).toBe(true);
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
		attachedSamples.every((sample) => sample.runningAnimations === 0),
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
	expect(
		closingSamples.length,
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
