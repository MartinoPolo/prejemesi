import { expect, type Locator } from '@playwright/test';

const EXIT_RECORDER_PROPERTY = '__prejemesiExitRecorder';

export interface ExitSample {
	connected: boolean;
	state: string | null;
	opacity: number;
	pointerEvents: string;
	text: string;
	source: 'frame' | 'animation-end' | 'detached';
}

export async function waitForAnimations(surface: Locator): Promise<void> {
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

export async function startExitRecording(surface: Locator): Promise<{
	finish: () => Promise<ExitSample[]>;
}> {
	const elementHandle = await surface.elementHandle();
	if (elementHandle === null) {
		throw new Error('Cannot record a detached surface');
	}

	await elementHandle.evaluate((element, recorderProperty) => {
		const samples: ExitSample[] = [];
		let animationFrameRequest = 0;

		function record(source: ExitSample['source']) {
			if (!element.isConnected) {
				samples.push({
					connected: false,
					state: element.getAttribute('data-state'),
					opacity: 0,
					pointerEvents: 'none',
					text: element.textContent ?? '',
					source: 'detached',
				});
				observer.disconnect();
				cancelAnimationFrame(animationFrameRequest);
				return;
			}

			const style = getComputedStyle(element);
			samples.push({
				connected: true,
				state: element.getAttribute('data-state'),
				opacity: Number.parseFloat(style.opacity),
				pointerEvents: style.pointerEvents,
				text: element.textContent ?? '',
				source,
			});
		}

		const observer = new MutationObserver(() => record('frame'));
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['data-state'],
			childList: true,
			subtree: true,
		});
		function handleAnimationEnd(event: Event) {
			if (event.target !== element || element.getAttribute('data-state') !== 'closed') {
				return;
			}
			record('animation-end');
			queueMicrotask(() => record('animation-end'));
			element.removeEventListener('animationend', handleAnimationEnd);
		}
		element.addEventListener('animationend', handleAnimationEnd);

		function sampleFrame() {
			record('frame');
			if (element.isConnected) {
				animationFrameRequest = requestAnimationFrame(sampleFrame);
			}
		}

		Reflect.set(element, recorderProperty, samples);
		animationFrameRequest = requestAnimationFrame(sampleFrame);
	}, EXIT_RECORDER_PROPERTY);

	return {
		finish: async () => {
			await expect
				.poll(() => elementHandle.evaluate((element) => element.isConnected))
				.toBe(false);
			return elementHandle.evaluate((element, recorderProperty) => {
				const samples: unknown = Reflect.get(element, recorderProperty);
				return Array.isArray(samples) ? samples : [];
			}, EXIT_RECORDER_PROPERTY);
		},
	};
}

export function expectStableExit(samples: readonly ExitSample[]): void {
	const closingSamples = samples.filter(
		(sample) => sample.connected && sample.state === 'closed',
	);
	expect(closingSamples.length, 'the closing surface was observed').toBeGreaterThan(0);
	expect(
		closingSamples.every((sample) => sample.pointerEvents === 'none'),
		'a closing surface is not interactive',
	).toBe(true);
	expect(
		closingSamples.some((sample) => sample.source === 'animation-end'),
		'the exit animation completed before detach',
	).toBe(true);

	let lowestOpacity = 1;
	for (const sample of closingSamples) {
		expect(sample.opacity, 'opacity does not rebound during exit').toBeLessThanOrEqual(
			lowestOpacity + 0.08,
		);
		lowestOpacity = Math.min(lowestOpacity, sample.opacity);
	}
	expect(lowestOpacity, 'the exit reaches transparency').toBeLessThanOrEqual(0.12);
	expect(samples.at(-1)?.connected, 'the surface is eventually detached').toBe(false);
}
