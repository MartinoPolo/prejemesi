import { expect, test, type Locator, type Page } from '@playwright/test';
import {
	loginViaApi,
	parseCookiesForContext,
	waitForAppHydration,
} from './fixtures/auth-helpers.js';
import {
	expectStableExit,
	startExitRecording,
	waitForAnimations,
} from './overlay-transitions.helpers.js';

const OVERLAY_OBSERVER_PROPERTY = '__prejemesiHeaderOverlayObserver';
const LANGUAGE_TRIGGER_NAME = /^(Jazyk|Language):/;
const NOTIFICATION_TRIGGER_NAME = /^(Upozornění|Notifications) \(/;
const ACCOUNT_TRIGGER_NAME = /(– menu uživatele|– user menu)$/;

interface OverlayOverlapSample {
	time: number;
	popoverText: string;
	tooltipText: string;
}

async function observeVisibleTooltipFrames(page: Page, duration: number): Promise<string[]> {
	return page.evaluate(
		({ duration, tooltipSlot }) =>
			new Promise((resolve) => {
				const visibleTooltipFrames: string[] = [];
				const startedAt = performance.now();

				function sampleFrame() {
					for (const element of document.querySelectorAll(tooltipSlot)) {
						if (!(element instanceof HTMLElement)) {
							continue;
						}
						const bounds = element.getBoundingClientRect();
						const style = getComputedStyle(element);
						if (
							bounds.width > 0 &&
							bounds.height > 0 &&
							style.visibility !== 'hidden' &&
							Number.parseFloat(style.opacity) > 0.01
						) {
							visibleTooltipFrames.push(element.textContent ?? '');
						}
					}

					if (performance.now() - startedAt < duration) {
						requestAnimationFrame(sampleFrame);
					} else {
						resolve(visibleTooltipFrames);
					}
				}

				requestAnimationFrame(sampleFrame);
			}),
		{ duration, tooltipSlot: '[data-slot="tooltip-content"]' },
	);
}

async function openAuthenticatedPage(page: Page, baseURL: string, rawCookies: string[]) {
	await page.context().addCookies(parseCookiesForContext(rawCookies, baseURL));
	await page.setViewportSize({ width: 1200, height: 720 });
	await page.goto('/my-lists', { waitUntil: 'domcontentloaded' });
	await waitForAppHydration(page);
}

async function tabToElement(page: Page, target: Locator): Promise<void> {
	for (let tabIndex = 0; tabIndex < 20; tabIndex += 1) {
		await page.keyboard.press('Tab');
		if (await target.evaluate((element) => element === document.activeElement)) {
			return;
		}
	}

	throw new Error('Keyboard navigation did not reach the target');
}

async function startOverlayExclusivityRecording(page: Page): Promise<{
	finish: () => Promise<OverlayOverlapSample[]>;
}> {
	await page.evaluate((recorderProperty) => {
		const overlapSamples: OverlayOverlapSample[] = [];
		let animationFrameRequest = 0;

		function isVisible(element: Element): element is HTMLElement {
			if (!(element instanceof HTMLElement) || !element.isConnected) {
				return false;
			}
			const bounds = element.getBoundingClientRect();
			const style = getComputedStyle(element);
			return (
				bounds.width > 0 &&
				bounds.height > 0 &&
				style.visibility !== 'hidden' &&
				Number.parseFloat(style.opacity) > 0.01
			);
		}

		function sample() {
			const popover = Array.from(
				document.querySelectorAll('[data-slot="popover-content"][data-state="open"]'),
			).find(isVisible);
			const tooltip = Array.from(
				document.querySelectorAll('[data-slot="tooltip-content"]'),
			).find(isVisible);
			if (popover && tooltip) {
				overlapSamples.push({
					time: performance.now(),
					popoverText: popover.textContent ?? '',
					tooltipText: tooltip.textContent ?? '',
				});
			}
		}

		const observer = new MutationObserver(sample);
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['data-state', 'style'],
			childList: true,
			subtree: true,
		});
		function sampleFrame() {
			sample();
			animationFrameRequest = requestAnimationFrame(sampleFrame);
		}
		animationFrameRequest = requestAnimationFrame(sampleFrame);
		Reflect.set(window, recorderProperty, {
			overlapSamples,
			stop() {
				observer.disconnect();
				cancelAnimationFrame(animationFrameRequest);
			},
		});
	}, OVERLAY_OBSERVER_PROPERTY);

	return {
		finish: () =>
			page.evaluate((recorderProperty) => {
				const recorder: unknown = Reflect.get(window, recorderProperty);
				if (
					typeof recorder !== 'object' ||
					recorder === null ||
					!('overlapSamples' in recorder) ||
					!Array.isArray(recorder.overlapSamples) ||
					!('stop' in recorder) ||
					typeof recorder.stop !== 'function'
				) {
					throw new Error('Header overlay observer was not initialized');
				}
				recorder.stop();
				return recorder.overlapSamples as OverlayOverlapSample[];
			}, OVERLAY_OBSERVER_PROPERTY),
	};
}

test.beforeEach(async ({ page, request, baseURL }) => {
	const cookies = await loginViaApi(request, baseURL!, {
		email: 'martin@test.cz',
		password: ['password', '123'].join(''),
	});
	await openAuthenticatedPage(page, baseURL!, cookies);
});

test('enabled language tooltip opens from keyboard focus and dismisses on blur', async ({
	page,
}) => {
	const trigger = page.getByRole('banner').getByRole('button', { name: LANGUAGE_TRIGGER_NAME });

	await tabToElement(page, trigger);
	await expect(trigger).toBeFocused();

	const tooltip = page.locator('[data-slot="tooltip-content"]', {
		hasText: 'Změnit jazyk',
	});
	await expect(tooltip).toBeVisible();
	const descriptionId = await trigger.getAttribute('aria-describedby');
	expect(descriptionId, 'the focused button references its tooltip').toBeTruthy();
	await expect(tooltip.locator(`[id="${descriptionId}"]`)).toHaveText('Změnit jazyk');
	await expect(trigger).toHaveAccessibleDescription('Změnit jazyk');

	await page.keyboard.press('Tab');
	await expect(trigger).not.toBeFocused();
	await expect(tooltip).toHaveCount(0);
});

test('language popover excludes both delayed and already-visible trigger tooltips', async ({
	page,
}) => {
	const trigger = page.getByRole('banner').getByRole('button', { name: LANGUAGE_TRIGGER_NAME });
	const popover = page.locator('[data-slot="popover-content"]').filter({
		has: page.getByText('Jazyk', { exact: true }),
	});
	const recording = await startOverlayExclusivityRecording(page);

	await trigger.hover();
	await page.waitForTimeout(100);
	await trigger.click();
	await expect(popover).toBeVisible();
	await page.waitForTimeout(750);
	await expect(page.getByText('Změnit jazyk', { exact: true })).toHaveCount(0);

	await page.keyboard.press('Escape');
	await expect(popover).toHaveCount(0);
	await page.mouse.move(4, 4);
	await trigger.hover();
	const visibleTooltip = page.getByText('Změnit jazyk', { exact: true });
	await expect(visibleTooltip).toBeVisible();
	await trigger.click();
	await expect(popover).toBeVisible();
	await expect(visibleTooltip).toHaveCount(0);

	expect(await recording.finish(), 'tooltip and attached popover never share a frame').toEqual(
		[],
	);
});

test('dismissed language popover does not revive its pending tooltip', async ({ page }) => {
	const trigger = page.getByRole('banner').getByRole('button', { name: LANGUAGE_TRIGGER_NAME });
	const popover = page.locator('[data-slot="popover-content"]').filter({
		has: page.getByText('Jazyk', { exact: true }),
	});

	await trigger.hover();
	await page.waitForTimeout(100);
	await trigger.click();
	await expect(popover).toBeVisible();
	await page.getByRole('heading', { name: 'Moje seznamy' }).click();
	await expect(popover).toHaveAttribute('data-state', 'closed');

	expect(
		await observeVisibleTooltipFrames(page, 750),
		'a pending hover cannot reopen the tooltip after outside dismissal',
	).toEqual([]);

	await trigger.hover();
	await expect(page.getByText('Změnit jazyk', { exact: true })).toBeVisible();
});

test('language popover survives rapid dismissal and reopen, then exits without opacity rebound', async ({
	page,
}) => {
	const trigger = page.getByRole('banner').getByRole('button', { name: LANGUAGE_TRIGGER_NAME });
	const popover = page.locator('[data-slot="popover-content"]').filter({
		has: page.getByText('Jazyk', { exact: true }),
	});

	await trigger.click();
	await expect(popover).toBeVisible();
	await page.getByRole('heading', { name: 'Moje seznamy' }).click();
	await trigger.click();
	await expect(popover).toHaveAttribute('data-state', 'open');
	await page.waitForTimeout(250);
	await expect(popover).toBeVisible();

	await waitForAnimations(popover);
	const recording = await startExitRecording(popover);
	await page.getByRole('heading', { name: 'Moje seznamy' }).click();
	expectStableExit(await recording.finish());
});

test('notification popover outside dismissal has a monotonic non-interactive exit', async ({
	page,
}) => {
	const trigger = page
		.getByRole('banner')
		.getByRole('button', { name: NOTIFICATION_TRIGGER_NAME });
	await trigger.click();
	const popover = page.locator('[data-slot="popover-content"]:visible');
	await waitForAnimations(popover);

	const recording = await startExitRecording(popover);
	await page.mouse.click(4, 4);
	expectStableExit(await recording.finish());
});

test('account dropdown keeps opening motion and restores keyboard focus after dismissal', async ({
	page,
}) => {
	const trigger = page.getByRole('banner').getByRole('button', { name: ACCOUNT_TRIGGER_NAME });
	await trigger.focus();
	await page.keyboard.press('Enter');
	const menu = page.locator('[data-slot="dropdown-menu-content"]:visible');
	await expect(menu).toBeVisible();
	expect(
		await menu.evaluate((element) =>
			element
				.getAnimations()
				.some((animation) => Number(animation.effect?.getComputedTiming().duration) > 0),
		),
		'normal motion retains the dropdown opening animation',
	).toBe(true);
	await waitForAnimations(menu);

	const recording = await startExitRecording(menu);
	await page.keyboard.press('Escape');
	expectStableExit(await recording.finish());
	await expect(trigger).toBeFocused();
});

test('reduced motion opens and dismisses the language popover without animation and restores focus', async ({
	page,
}) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.reload({ waitUntil: 'domcontentloaded' });
	await waitForAppHydration(page);
	const trigger = page.getByRole('banner').getByRole('button', { name: LANGUAGE_TRIGGER_NAME });
	await trigger.focus();
	await page.keyboard.press('Enter');
	const popover = page.locator('[data-slot="popover-content"]:visible');
	await expect(popover).toBeVisible();
	expect(await popover.evaluate((element) => element.getAnimations().length)).toBe(0);

	await page.keyboard.press('Escape');
	await expect(popover).toHaveCount(0);
	await expect(trigger).toBeFocused();
});
