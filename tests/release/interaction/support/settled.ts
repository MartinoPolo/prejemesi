import { expect, type Locator, type Page } from '@playwright/test';
import { pointOf, type TouchInput } from './touch.js';

export type OverlayLayer = 'dialog' | 'menu' | 'popover';

const LAYER_SELECTORS: Record<OverlayLayer, string> = {
	dialog: '[role="dialog"], [role="alertdialog"]',
	menu: '[role="menu"]',
	popover: '[data-slot="popover-content"]',
};
const MODAL_BACKDROP_SELECTOR = '[data-slot="dialog-overlay"], [data-slot="sheet-overlay"]';

/** Frames a scroll offset must hold before a fling or smooth scroll counts as finished. */
const SCROLL_REST_FRAMES = 10;

export function nextFrames(page: Page, count = 2): Promise<void> {
	return page.evaluate(
		(frames) =>
			new Promise<void>((resolve) => {
				let remaining = frames;
				const step = () => {
					remaining -= 1;
					if (remaining <= 0) {
						resolve();
					} else {
						requestAnimationFrame(step);
					}
				};
				requestAnimationFrame(step);
			}),
		count,
	);
}

/** Waits until no animation in the subtree is still running toward a finite end. */
export async function expectAnimationsFinished(page: Page, selector = 'body'): Promise<void> {
	await expect
		.poll(() =>
			page
				.locator(selector)
				.evaluate(
					(root) =>
						root
							.getAnimations({ subtree: true })
							.filter(
								(animation) =>
									animation.playState === 'running' &&
									animation.effect?.getComputedTiming().endTime !== Infinity,
							).length,
				),
		)
		.toBe(0);
}

/** Waits until the scroller's offset holds across several frames, so a fling or glide has ended. */
export async function expectScrollAtRest(
	scroller: Locator,
	axis: 'left' | 'top',
	message = 'scrolling comes to rest',
): Promise<void> {
	await expect
		.poll(
			() =>
				scroller.evaluate(
					(element, { property, frames }) =>
						new Promise<boolean>((resolve) => {
							const start = element[property];
							let remaining = frames;
							const check = () => {
								if (element[property] !== start) {
									resolve(false);
								} else if (--remaining <= 0) {
									resolve(true);
								} else {
									requestAnimationFrame(check);
								}
							};
							requestAnimationFrame(check);
						}),
					{
						property:
							axis === 'left' ? ('scrollLeft' as const) : ('scrollTop' as const),
						frames: SCROLL_REST_FRAMES,
					},
				),
			{ message },
		)
		.toBe(true);
}

/**
 * Samples the target once per animation frame until the returned function stops it: its
 * `scrollLeft`, or its top edge relative to its parent, which a moving transform shifts.
 */
export async function recordEveryFrame(
	target: Locator,
	measure: 'scrollLeft' | 'topInParent',
): Promise<() => Promise<number[]>> {
	const recorder = await target.evaluateHandle((element, measured) => {
		const samples: number[] = [];
		let frame = 0;
		const sample = () => {
			samples.push(
				measured === 'scrollLeft'
					? element.scrollLeft
					: element.getBoundingClientRect().top -
							(element.parentElement?.getBoundingClientRect().top ?? 0),
			);
			frame = requestAnimationFrame(sample);
		};
		sample();
		return {
			samples,
			stop() {
				cancelAnimationFrame(frame);
			},
		};
	}, measure);
	return async () => {
		const samples = await recorder.evaluate((state) => {
			state.stop();
			return state.samples;
		});
		await recorder.dispose();
		return samples;
	};
}

/** Distinct samples strictly between the start and end values: the frames of a glide. */
export function glideFrames(samples: readonly number[], from: number, to: number): number {
	const low = Math.min(from, to) + 0.5;
	const high = Math.max(from, to) - 0.5;
	return new Set(samples.filter((sample) => sample > low && sample < high)).size;
}

export interface PageErrorCollector {
	/** Returns and forgets the errors collected since the previous call. */
	take(): string[];
}

/** Collects uncaught page errors and console errors, except messages matching `ignored`. */
export function collectPageErrors(page: Page, ignored: readonly RegExp[] = []): PageErrorCollector {
	let errors: string[] = [];
	const record = (message: string) => {
		if (!ignored.some((pattern) => pattern.test(message))) {
			errors.push(message);
		}
	};
	page.on('pageerror', (error) => record(`pageerror: ${error.message}`));
	page.on('console', (message) => {
		if (message.type() === 'error') {
			record(`console: ${message.text()}`);
		}
	});
	return {
		take() {
			const taken = errors;
			errors = [];
			return taken;
		},
	};
}

export interface PageSettledOptions {
	errors: PageErrorCollector;
	/** The URL the page must still show; interactions that navigate pass the new one. */
	expectedUrl: string;
	/** A harmless element that a final ordinary press must reach; inside the layer if one stays open. */
	neutralTarget: Locator;
	/** Presses the neutral target with touch when given, otherwise with the mouse. */
	touch?: TouchInput;
	/** Layers the interaction is meant to leave open; a modal one skips the body checks. */
	allowedOpenLayers?: readonly OverlayLayer[];
	/** Surface-specific marks of an unfinished gesture, such as a pending long press. */
	transientStateSelectors?: readonly string[];
	/** A mouse drag across text selects it, which the app must preserve rather than prevent. */
	allowTextSelection?: boolean;
}

function visibleLayers(page: Page, layer: OverlayLayer): Locator {
	return page.locator(LAYER_SELECTORS[layer]).filter({ visible: true });
}

/**
 * Asserts the page is usable again after an interaction: nothing unexpected left open, no body
 * pointer or scroll lock, no stray text selection or gesture state, the same URL, no errors, and an
 * ordinary press on a neutral element still arrives.
 */
export async function expectPageSettled(page: Page, options: PageSettledOptions): Promise<void> {
	const allowed = new Set(options.allowedOpenLayers ?? []);
	for (const layer of ['dialog', 'menu', 'popover'] as const) {
		if (!allowed.has(layer)) {
			await expect(visibleLayers(page, layer), `no ${layer} is left open`).toHaveCount(0);
		}
	}
	const modalLayerOpen =
		allowed.has('dialog') && (await visibleLayers(page, 'dialog').count()) > 0;
	if (!modalLayerOpen) {
		await expect(
			page.locator(MODAL_BACKDROP_SELECTOR),
			'no modal backdrop remains',
		).toHaveCount(0);
		await expect
			.poll(
				() =>
					page.evaluate(() => ({
						inlinePointerEvents: document.body.style.pointerEvents,
						computedPointerEvents: getComputedStyle(document.body).pointerEvents,
						bodyOverflow: document.body.style.overflow,
						rootOverflow: document.documentElement.style.overflow,
					})),
				{ message: 'body pointer events and scrolling are restored' },
			)
			.toEqual({
				inlinePointerEvents: '',
				computedPointerEvents: 'auto',
				bodyOverflow: '',
				rootOverflow: '',
			});
	}

	if (options.allowTextSelection === true) {
		await page.evaluate(() => document.getSelection()?.removeAllRanges());
	} else {
		expect(
			await page.evaluate(() => document.getSelection()?.toString() ?? ''),
			'no text is selected',
		).toBe('');
	}
	for (const selector of options.transientStateSelectors ?? []) {
		await expect(page.locator(selector), `no ${selector} remains`).toHaveCount(0);
	}
	expect(page.url(), 'the interaction kept the page URL').toBe(options.expectedUrl);
	expect(options.errors.take(), 'no page or console errors').toEqual([]);

	// Behind an open modal layer only a target inside that layer can still be pressed.
	const neutralTargetReachable =
		!modalLayerOpen ||
		(await options.neutralTarget.evaluate(
			(element) => element.closest('[role="dialog"], [role="alertdialog"]') !== null,
		));
	if (neutralTargetReachable) {
		await expectPressReaches(page, options.neutralTarget, options.touch);
	}
}

/**
 * Presses the target with real input and checks the click arrives there, so a leftover overlay,
 * pointer capture or document-level click guard fails the check. The probe consumes the click,
 * keeping the press free of side effects.
 */
async function expectPressReaches(page: Page, target: Locator, touch: TouchInput | undefined) {
	await target.evaluate((element) => element.scrollIntoView({ block: 'center' }));
	const point = await pointOf(target);
	const probe = await target.evaluateHandle((element) => {
		const received: string[] = [];
		const record = (event: Event) => {
			received.push(event.type);
			if (event.type === 'click') {
				event.preventDefault();
				event.stopPropagation();
			}
		};
		element.addEventListener('pointerdown', record, { capture: true });
		element.addEventListener('click', record, { capture: true });
		return {
			received,
			remove() {
				element.removeEventListener('pointerdown', record, { capture: true });
				element.removeEventListener('click', record, { capture: true });
			},
		};
	});
	try {
		if (touch === undefined) {
			await page.mouse.click(point.x, point.y);
		} else {
			await touch.tap(point);
		}
		await expect
			.poll(() => probe.evaluate((state) => state.received), {
				message: 'an ordinary press on the neutral target still arrives',
			})
			.toEqual(['pointerdown', 'click']);
	} finally {
		await probe.evaluate((state) => state.remove());
		await probe.dispose();
	}
}
