import { expect, test, type Locator, type Page } from '@playwright/test';
import {
	loginViaApi,
	parseCookiesForContext,
	waitForAppHydration,
} from './fixtures/auth-helpers.js';

const EXIT_RECORDER_PROPERTY = '__prejemesiExitRecorder';

interface ExitSample {
	connected: boolean;
	state: string | null;
	opacity: number;
	pointerEvents: string;
	text: string;
	source: 'frame' | 'animation-end' | 'detached';
}

async function waitForAnimations(surface: Locator): Promise<void> {
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

async function startExitRecording(surface: Locator): Promise<{
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

function expectStableExit(samples: readonly ExitSample[]): void {
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

async function openSeedWishlist(
	page: Page,
	request: Parameters<typeof loginViaApi>[0],
	baseURL: string,
	email = 'martin@test.cz',
) {
	const cookies = await loginViaApi(request, baseURL, {
		email,
		password: ['password', '123'].join(''),
	});
	await page.context().addCookies(parseCookiesForContext(cookies, baseURL));
	await page.goto('/w/xmas2026', { waitUntil: 'domcontentloaded' });
	await waitForAppHydration(page);
}

async function hoverDisplaySubmenu(page: Page, name: RegExp): Promise<Locator> {
	const root = page.locator('[data-slot="dropdown-menu-content"]:visible').last();
	const trigger = root.getByRole('menuitem', { name });
	await trigger.hover();
	await expect(trigger).toHaveAttribute('aria-expanded', 'true');
	const controlledId = await trigger.getAttribute('aria-controls');
	expect(controlledId).not.toBeNull();
	const submenu = page.locator(`[id=${JSON.stringify(controlledId)}]`);
	await expect(submenu).toBeVisible();
	return submenu;
}

test('nested Display menus keep their transparent exit frame through switching and dismissal', async ({
	page,
	request,
	baseURL,
}) => {
	await page.setViewportSize({ width: 1100, height: 700 });
	await openSeedWishlist(page, request, baseURL!);
	await page.getByTestId('desktop-display-trigger').filter({ visible: true }).click();

	const root = page.locator('[data-slot="dropdown-menu-content"]:visible').last();
	const outgoingSubmenu = await hoverDisplaySubmenu(page, /Řadit podle/);
	await waitForAnimations(outgoingSubmenu);
	const outgoingRecording = await startExitRecording(outgoingSubmenu);
	const activeSubmenu = await hoverDisplaySubmenu(page, /Seskupení/);
	expectStableExit(await outgoingRecording.finish());

	const rootRecording = await startExitRecording(root);
	const submenuRecording = await startExitRecording(activeSubmenu);
	await page.mouse.click(4, 4);
	const [rootSamples, submenuSamples] = await Promise.all([
		rootRecording.finish(),
		submenuRecording.finish(),
	]);
	expectStableExit(rootSamples);
	expectStableExit(submenuSamples);
});

test('gift details retain their identity throughout the closing animation', async ({
	page,
	request,
	baseURL,
}) => {
	await openSeedWishlist(page, request, baseURL!, 'petr@test.cz');
	const giftName = 'PlayStation 5';
	const giftDescription = 'Nejnovější verze, s mechanikou na disky';
	const giftItem = page.locator('[data-gift-item]').filter({
		has: page.getByRole('heading', { name: giftName, exact: true }),
	});
	await giftItem.focus();
	await page.keyboard.press('Enter');

	const dialog = page.getByRole('dialog').filter({
		has: page.getByRole('heading', { name: giftName, exact: true }),
	});
	const overlay = page.locator('[data-slot="dialog-overlay"]:visible');
	await waitForAnimations(dialog);
	const dialogRecording = await startExitRecording(dialog);
	const overlayRecording = await startExitRecording(overlay);

	await page.keyboard.press('Escape');
	const [dialogSamples, overlaySamples] = await Promise.all([
		dialogRecording.finish(),
		overlayRecording.finish(),
	]);
	expectStableExit(dialogSamples);
	expectStableExit(overlaySamples);
	expect(
		dialogSamples
			.filter((sample) => sample.connected && sample.state === 'closed')
			.every(
				(sample) => sample.text.includes(giftName) && sample.text.includes(giftDescription),
			),
		'the outgoing dialog never changes to another gift or an empty form',
	).toBe(true);
	await expect(giftItem).toBeFocused();
});
