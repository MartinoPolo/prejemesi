import { expect, type CDPSession, type Locator, type Page } from '@playwright/test';

/*
 * Real touch input through CDP `Input.dispatchTouchEvent`, so Chromium runs its own gesture
 * pipeline instead of the test synthesizing DOM events. Measured in a `hasTouch`/`isMobile`
 * Chromium context:
 * - A tap yields pointerdown, pointerup, compatibility mousedown/mouseup, then a touch click.
 * - A long hold never yields `contextmenu`, and its release still clicks whatever is under the
 *   finger by then, such as an action in a sheet the hold opened. Android instead fires
 *   `contextmenu` mid-press and ends the long press without a click, so `withNativeContextMenu`
 *   re-creates that event and releases after Android's long-press timeout drop the click.
 * - Drifts within Chromium's touch slop (12 px is still within it) keep the pointer stream and
 *   still click on release; larger moves start native scrolling: pointercancel, scroll events on
 *   the scroll container, then a fling after release, and no click. The first tap during a fling
 *   only stops it, as on phones, so wait until the scroll offset holds before the next press.
 * - touchCancel yields pointercancel; a second finger adds its own pointerdown.
 */

export interface ScreenPoint {
	x: number;
	y: number;
}

/** A locator pressed at its center (or at `offset` from its top-left), or an explicit point. */
export type PressTarget = Locator | ScreenPoint | { locator: Locator; offset: ScreenPoint };

/** Android fires `contextmenu` at its long-press timeout, before the app's own recognizer. */
const ANDROID_LONG_PRESS_TIMEOUT_MS = 450;
/** A real tap keeps the finger down for a few frames; an instant release is not what phones send. */
const TAP_CONTACT_MS = 40;
/**
 * The finger stays still this long before lifting at the end of a drag that places something.
 * Lifting mid-move starts a fling, and Chromium spends the next tap on stopping it.
 */
const FINGER_REST_MS = 150;
const MOVE_STEPS = 8;
const DRIFT_STEP_PX = 4;
const CLICK_AFTER_RELEASE_WINDOW_MS = 300;

function isLocator(target: PressTarget): target is Locator {
	return typeof (target as Locator).boundingBox === 'function';
}

export async function pointOf(target: PressTarget): Promise<ScreenPoint> {
	if (!isLocator(target) && !('locator' in target)) {
		return target;
	}
	const locator = isLocator(target) ? target : target.locator;
	const box = await locator.boundingBox();
	expect(box, 'press target has a layout box').not.toBeNull();
	if (!isLocator(target)) {
		return { x: box!.x + target.offset.x, y: box!.y + target.offset.y };
	}
	return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
}

function interpolate(from: ScreenPoint, to: ScreenPoint, fraction: number): ScreenPoint {
	return { x: from.x + (to.x - from.x) * fraction, y: from.y + (to.y - from.y) * fraction };
}

function nextAnimationFrame(page: Page): Promise<void> {
	return page.evaluate(
		() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
	);
}

export interface NativeContextMenuResult {
	/** Whether the page cancelled the event, which on Android suppresses the browser's own menu. */
	defaultPrevented: boolean;
}

export interface HoldOptions {
	/** Dispatches Android's mid-press `contextmenu` on the pressed element. */
	withNativeContextMenu?: boolean;
	/** Runs while the finger is still down, after the hold duration. */
	beforeRelease?: () => Promise<void>;
}

export interface TouchInput {
	tap(target: PressTarget): Promise<void>;
	/**
	 * Taps twice on one point. `betweenTaps` waits for what the first tap opens: a phone shows it
	 * within a double tap's gap, a loaded test machine may not.
	 */
	doubleTap(target: PressTarget, betweenTaps: () => Promise<void>): Promise<void>;
	hold(
		target: PressTarget,
		durationMs: number,
		options?: HoldOptions,
	): Promise<NativeContextMenuResult | null>;
	/** Presses, drifts `distancePx` sideways after `driftAfterMs`, and holds until `durationMs`. */
	holdThenDrift(
		target: PressTarget,
		options: {
			distancePx: number;
			durationMs: number;
			driftAfterMs?: number;
			beforeRelease?: () => Promise<void>;
		},
	): Promise<void>;
	/** Presses for `holdMs`, then swipes upward by `distancePx` so the content scrolls down. */
	holdThenScroll(
		target: PressTarget,
		options: { holdMs: number; distancePx: number },
	): Promise<void>;
	swipe(from: PressTarget, to: PressTarget): Promise<void>;
	/**
	 * Holds on the first point for `holdMs`, then follows the path a frame per step. With
	 * `endAtRest` the finger stays still before lifting, as when placing something.
	 */
	drag(
		path: readonly PressTarget[],
		options?: { holdMs?: number; endAtRest?: boolean; beforeRelease?: () => Promise<void> },
	): Promise<void>;
	/** Two fingers level with `center` move apart (or together) from one distance to the other. */
	pinch(
		center: PressTarget,
		options: { fromDistancePx: number; toDistancePx: number },
	): Promise<void>;
	/** Starts a hold, adds a second finger after `secondFingerAfterMs`, releases both at `durationMs`. */
	twoFingerDuringHold(
		target: PressTarget,
		options: {
			secondFingerAfterMs: number;
			durationMs: number;
			beforeRelease?: () => Promise<void>;
		},
	): Promise<void>;
}

export async function createTouchInput(page: Page): Promise<TouchInput> {
	const cdp: CDPSession = await page.context().newCDPSession(page);

	async function touchStart(...points: ScreenPoint[]) {
		await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points });
	}
	async function touchMove(...points: ScreenPoint[]) {
		await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points });
	}
	async function touchEnd() {
		await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
	}
	/** Releases the way a phone ends a press held past its long-press timeout: without a click. */
	async function releaseHold(startedAt: number) {
		if (Date.now() - startedAt <= ANDROID_LONG_PRESS_TIMEOUT_MS) {
			await touchEnd();
			return;
		}
		await page.evaluate((windowMs) => {
			const dropClick = (event: Event) => {
				event.preventDefault();
				event.stopImmediatePropagation();
			};
			window.addEventListener('click', dropClick, { capture: true, once: true });
			setTimeout(
				() => window.removeEventListener('click', dropClick, { capture: true }),
				windowMs,
			);
		}, CLICK_AFTER_RELEASE_WINDOW_MS);
		await touchEnd();
	}
	async function moveAlong(from: ScreenPoint, to: ScreenPoint, steps = MOVE_STEPS) {
		for (let step = 1; step <= steps; step += 1) {
			await touchMove(interpolate(from, to, step / steps));
			await nextAnimationFrame(page);
		}
	}
	async function waitUntil(startedAt: number, elapsedMs: number) {
		const remaining = elapsedMs - (Date.now() - startedAt);
		if (remaining > 0) {
			await page.waitForTimeout(remaining);
		}
	}
	function dispatchNativeContextMenu(point: ScreenPoint): Promise<NativeContextMenuResult> {
		return page.evaluate(({ x, y }) => {
			const pressed = document.elementFromPoint(x, y);
			const event = new PointerEvent('contextmenu', {
				bubbles: true,
				cancelable: true,
				composed: true,
				pointerType: 'touch',
				button: 2,
				clientX: x,
				clientY: y,
			});
			pressed?.dispatchEvent(event);
			return { defaultPrevented: event.defaultPrevented };
		}, point);
	}

	async function tapAt(point: ScreenPoint) {
		await touchStart(point);
		await page.waitForTimeout(TAP_CONTACT_MS);
		await touchEnd();
	}
	/** A check that fails mid-press still lifts the fingers, so the next press starts without them. */
	async function whilePressed(check: (() => Promise<void>) | undefined) {
		try {
			await check?.();
		} catch (error) {
			await touchEnd();
			throw error;
		}
	}

	return {
		async tap(target) {
			await tapAt(await pointOf(target));
		},
		async doubleTap(target, betweenTaps) {
			const point = await pointOf(target);
			await tapAt(point);
			await betweenTaps();
			await tapAt(point);
		},
		async hold(target, durationMs, { withNativeContextMenu = false, beforeRelease } = {}) {
			const point = await pointOf(target);
			const startedAt = Date.now();
			await touchStart(point);
			let nativeContextMenu: NativeContextMenuResult | null = null;
			if (withNativeContextMenu && durationMs > ANDROID_LONG_PRESS_TIMEOUT_MS) {
				await waitUntil(startedAt, ANDROID_LONG_PRESS_TIMEOUT_MS);
				nativeContextMenu = await dispatchNativeContextMenu(point);
			}
			await waitUntil(startedAt, durationMs);
			await whilePressed(beforeRelease);
			await releaseHold(startedAt);
			return nativeContextMenu;
		},
		async holdThenDrift(target, { distancePx, durationMs, driftAfterMs = 100, beforeRelease }) {
			const point = await pointOf(target);
			const startedAt = Date.now();
			await touchStart(point);
			await waitUntil(startedAt, driftAfterMs);
			// Few steps keep the drift short even on a loaded machine, so it ends before any recognizer.
			const steps = Math.max(1, Math.ceil(distancePx / DRIFT_STEP_PX));
			await moveAlong(point, { x: point.x + distancePx, y: point.y }, steps);
			await waitUntil(startedAt, durationMs);
			await whilePressed(beforeRelease);
			await releaseHold(startedAt);
		},
		async holdThenScroll(target, { holdMs, distancePx }) {
			const point = await pointOf(target);
			await touchStart(point);
			await page.waitForTimeout(holdMs);
			await moveAlong(point, { x: point.x, y: point.y - distancePx });
			await touchEnd();
		},
		async swipe(from, to) {
			const start = await pointOf(from);
			const end = await pointOf(to);
			await touchStart(start);
			await moveAlong(start, end);
			await touchEnd();
		},
		async drag(path, { holdMs = 0, endAtRest = false, beforeRelease } = {}) {
			const points: ScreenPoint[] = [];
			for (const target of path) {
				points.push(await pointOf(target));
			}
			const [first] = points;
			expect(first, 'a drag path has a start').toBeDefined();
			await touchStart(first!);
			await page.waitForTimeout(holdMs);
			for (let index = 1; index < points.length; index += 1) {
				await moveAlong(points[index - 1]!, points[index]!);
			}
			if (endAtRest) {
				await page.waitForTimeout(FINGER_REST_MS);
			}
			await whilePressed(beforeRelease);
			await touchEnd();
		},
		async pinch(center, { fromDistancePx, toDistancePx }) {
			const middle = await pointOf(center);
			const fingersAt = (distance: number): [ScreenPoint, ScreenPoint] => [
				{ x: middle.x - distance / 2, y: middle.y },
				{ x: middle.x + distance / 2, y: middle.y },
			];
			await touchStart(...fingersAt(fromDistancePx));
			for (let step = 1; step <= MOVE_STEPS; step += 1) {
				const distance =
					fromDistancePx + ((toDistancePx - fromDistancePx) * step) / MOVE_STEPS;
				await touchMove(...fingersAt(distance));
				await nextAnimationFrame(page);
			}
			await touchEnd();
		},
		async twoFingerDuringHold(target, { secondFingerAfterMs, durationMs, beforeRelease }) {
			const point = await pointOf(target);
			const startedAt = Date.now();
			await touchStart(point);
			await waitUntil(startedAt, secondFingerAfterMs);
			await touchStart(point, { x: point.x + 40, y: point.y + 40 });
			await waitUntil(startedAt, durationMs);
			await whilePressed(beforeRelease);
			await releaseHold(startedAt);
		},
	};
}

/** Right button press and release, which makes Chromium fire `contextmenu`. */
export async function rightClick(page: Page, target: PressTarget): Promise<void> {
	const point = await pointOf(target);
	await page.mouse.click(point.x, point.y, { button: 'right' });
}

/** Left-button drag along the path, a frame per step, so pointer-driven drags follow it. */
export async function mouseDrag(page: Page, path: readonly PressTarget[]): Promise<void> {
	const points: ScreenPoint[] = [];
	for (const target of path) {
		points.push(await pointOf(target));
	}
	const [first] = points;
	expect(first, 'a drag path has a start').toBeDefined();
	await page.mouse.move(first!.x, first!.y);
	await page.mouse.down();
	for (let index = 1; index < points.length; index += 1) {
		for (let step = 1; step <= MOVE_STEPS; step += 1) {
			const point = interpolate(points[index - 1]!, points[index]!, step / MOVE_STEPS);
			await page.mouse.move(point.x, point.y);
			await nextAnimationFrame(page);
		}
	}
	await page.mouse.up();
}
