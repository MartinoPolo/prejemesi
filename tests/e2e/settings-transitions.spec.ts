import { test, expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import { createWishlistAndNavigate } from './fixtures/wishlist-helpers.js';
import {
	expectDirectUnmountWithoutFlash,
	expectModalCleanup,
	expectReducedMotionDirectExit,
	expectSmoothNonInteractiveExit,
	finishTransitionObservation,
	startTransitionObservation,
	waitForSurfaceMotionToSettle,
	type TransitionSample,
} from './settings-transitions.helpers.js';

const SETTINGS_NAME = 'Nastavení seznamu';
const UNSAVED_NAME = 'Máte neuložené změny';

async function createDisposableWishlist(
	browser: Parameters<typeof registerAndGetPage>[0],
	request: Parameters<typeof registerAndGetPage>[1],
	baseURL: string,
	testIdentity: string,
): Promise<{ page: Page; title: string; trigger: Locator; settings: Locator }> {
	const page = await registerAndGetPage(browser, request, baseURL, createTestUser(testIdentity));
	const title = `Přechody nastavení ${testIdentity}`;
	await createWishlistAndNavigate(page, title);
	await page.setViewportSize({ width: 1100, height: 720 });
	const trigger = page.getByRole('button', { name: SETTINGS_NAME });
	await trigger.click();
	const settings = page.getByRole('dialog', { name: SETTINGS_NAME });
	await waitForSurfaceMotionToSettle(settings);
	return { page, title, trigger, settings };
}

interface DialogExitSamples {
	contents: TransitionSample[][];
	overlays: TransitionSample[][];
}

async function recordDialogExit(
	page: Page,
	closingDialogs: readonly Locator[],
	close: () => Promise<void>,
	options: { remainingDialogs?: readonly Locator[]; closingOverlayCount?: number } = {},
): Promise<DialogExitSamples> {
	const remainingDialogs = options.remainingDialogs ?? [];
	const overlayLocators = await page.locator('[data-slot="dialog-overlay"]:visible').all();
	const expectedClosingOverlayCount = options.closingOverlayCount ?? overlayLocators.length;
	expect(
		overlayLocators.length,
		'all overlays for closing and remaining dialogs are captured before dismissal',
	).toBe(expectedClosingOverlayCount + remainingDialogs.length);

	const [contentHandles, overlayHandles] = await Promise.all([
		Promise.all(closingDialogs.map((dialog) => startTransitionObservation(dialog))),
		Promise.all(overlayLocators.map((overlay) => startTransitionObservation(overlay))),
	]);
	await close();
	await Promise.all([
		...closingDialogs.map((dialog) => expect(dialog).toHaveCount(0)),
		...remainingDialogs.map((dialog) => expect(dialog).toBeVisible()),
	]);
	await expect
		.poll(async () => {
			const connected = await Promise.all(
				overlayHandles.map((handle) => handle.evaluate((element) => element.isConnected)),
			);
			return connected.filter((isConnected) => !isConnected).length;
		})
		.toBe(expectedClosingOverlayCount);
	await Promise.all(
		contentHandles.map((handle) =>
			expect.poll(() => handle.evaluate((element) => element.isConnected)).toBe(false),
		),
	);
	const overlayConnectionStates = await Promise.all(
		overlayHandles.map((handle) => handle.evaluate((element) => element.isConnected)),
	);

	const [contents, overlays] = await Promise.all([
		Promise.all(contentHandles.map((handle) => finishTransitionObservation(page, handle))),
		Promise.all(
			overlayHandles.map((handle, index) =>
				finishTransitionObservation(page, handle, {
					expectDetached: !overlayConnectionStates[index],
				}),
			),
		),
	]);
	return { contents, overlays };
}

async function attachSamples(
	testInfo: TestInfo,
	name: string,
	samples: DialogExitSamples,
): Promise<void> {
	await testInfo.attach(name, {
		body: Buffer.from(`${JSON.stringify(samples, null, 2)}\n`),
		contentType: 'application/json',
	});
}

test('transition observation captures a short exit when animation frames are skipped', async ({
	page,
}) => {
	await page.setContent(`
		<style>
			@keyframes test-exit { from { opacity: 1; } to { opacity: 0; } }
			[data-state='closed'] { animation: test-exit 30ms linear forwards; pointer-events: none; }
		</style>
		<div data-testid="short-exit" data-state="open">Surface</div>
	`);
	await page.evaluate(() => {
		Object.defineProperty(window, 'requestAnimationFrame', {
			configurable: true,
			value: (callback: FrameRequestCallback) =>
				window.setTimeout(() => callback(performance.now()), 100),
		});
	});
	const surface = page.getByTestId('short-exit');
	const surfaceHandle = await startTransitionObservation(surface);

	await surface.evaluate((element) => {
		element.addEventListener('animationend', () => element.remove(), { once: true });
		element.setAttribute('data-state', 'closed');
	});
	await expect(surface).toHaveCount(0);

	const samples = await finishTransitionObservation(page, surfaceHandle);
	expectSmoothNonInteractiveExit(samples, { requireVisibleTransition: true });
});

test('transition oracle rejects an exit that loses its transparent fill before detach', async ({
	page,
}) => {
	await page.setContent(`
		<style>
			@keyframes faulty-exit { from { opacity: 1; } to { opacity: 0; } }
			[data-state='closed'] { animation: faulty-exit 30ms linear; pointer-events: none; }
		</style>
		<div data-testid="faulty-exit" data-state="open">Surface</div>
	`);
	const surface = page.getByTestId('faulty-exit');
	const surfaceHandle = await startTransitionObservation(surface);

	await surface.evaluate((element) => {
		element.addEventListener(
			'animationend',
			() => window.setTimeout(() => element.remove(), 20),
			{ once: true },
		);
		element.setAttribute('data-state', 'closed');
	});
	await expect(surface).toHaveCount(0);

	const samples = await finishTransitionObservation(page, surfaceHandle);
	expect(() =>
		expectSmoothNonInteractiveExit(samples, { requireVisibleTransition: true }),
	).toThrow(/opacity|transparent final state/);
});

function expectSmoothDialogExit(
	samples: DialogExitSamples,
	expectedClosingOverlayCount = samples.overlays.length,
): void {
	for (const contentSamples of samples.contents) {
		expectSmoothNonInteractiveExit(contentSamples, { requireVisibleTransition: true });
	}

	const closingOverlays = samples.overlays.filter(
		(overlaySamples) => overlaySamples.at(-1)?.connected === false,
	);
	expect(closingOverlays).toHaveLength(expectedClosingOverlayCount);
	for (const overlaySamples of closingOverlays) {
		expectSmoothNonInteractiveExit(overlaySamples, { requireVisibleTransition: true });
	}

	for (const remainingOverlay of samples.overlays.filter(
		(overlaySamples) => overlaySamples.at(-1)?.connected === true,
	)) {
		expect(remainingOverlay.at(-1)).toMatchObject({
			connected: true,
			state: 'open',
			opacity: 1,
			pointerEvents: 'auto',
		});
	}
}

for (const dismissal of ['Escape', 'outside click'] as const) {
	test(`clean settings ${dismissal} fades out without opacity rebound`, async ({
		browser,
		request,
		baseURL,
	}, testInfo) => {
		const { page, trigger, settings } = await createDisposableWishlist(
			browser,
			request,
			baseURL!,
			`clean-${dismissal.replace(' ', '-')}`,
		);

		const samples = await recordDialogExit(page, [settings], async () => {
			if (dismissal === 'Escape') {
				await page.keyboard.press('Escape');
				return;
			}
			await page
				.locator('[data-slot="dialog-overlay"]:visible')
				.click({ position: { x: 4, y: 4 } });
		});

		expectSmoothDialogExit(samples);
		await expectModalCleanup(page, trigger);
		await attachSamples(testInfo, `clean-${dismissal.replace(' ', '-')}`, samples);
		await page.context().close();
	});
}

test('dirty Continue editing closes only the guard without opacity rebound', async ({
	browser,
	request,
	baseURL,
}, testInfo) => {
	const { page, title, settings } = await createDisposableWishlist(
		browser,
		request,
		baseURL!,
		'dirty-continue',
	);
	const titleInput = settings.getByRole('textbox', { name: 'Název' });
	await titleInput.fill(`${title} rozepsáno`);
	await page.keyboard.press('Escape');
	const guard = page.getByRole('dialog', { name: UNSAVED_NAME });
	await waitForSurfaceMotionToSettle(guard);

	const samples = await recordDialogExit(
		page,
		[guard],
		async () => {
			await guard.getByRole('button', { name: 'Pokračovat v úpravách' }).click();
		},
		{ remainingDialogs: [settings], closingOverlayCount: 1 },
	);

	expectSmoothDialogExit(samples, 1);
	await expect(settings).toBeVisible();
	await expect(titleInput).toHaveValue(`${title} rozepsáno`);
	await attachSamples(testInfo, 'dirty-continue', samples);

	await titleInput.fill(title);
	await settings.getByRole('button', { name: 'Zavřít' }).click();
	await expect(settings).toHaveCount(0);
	await page.context().close();
});

test('dirty Discard closes settings without rebound and discards the draft', async ({
	browser,
	request,
	baseURL,
}, testInfo) => {
	const { page, title, trigger, settings } = await createDisposableWishlist(
		browser,
		request,
		baseURL!,
		'dirty-discard',
	);
	await settings.getByRole('textbox', { name: 'Název' }).fill(`${title} zahodit`);
	await page.keyboard.press('Escape');
	const guard = page.getByRole('dialog', { name: UNSAVED_NAME });
	await waitForSurfaceMotionToSettle(guard);

	const samples = await recordDialogExit(page, [settings, guard], async () => {
		await guard.getByRole('button', { name: 'Zahodit změny' }).click();
	});

	expectSmoothDialogExit(samples);
	await expectModalCleanup(page, trigger, { requireRestoredFocus: false });
	await attachSamples(testInfo, 'dirty-discard', samples);

	await trigger.click();
	await expect(
		page.getByRole('dialog', { name: SETTINGS_NAME }).getByRole('textbox', { name: 'Název' }),
	).toHaveValue(title);
	await page.context().close();
});

test('dirty Save and continue closes without rebound after saving the disposable wishlist', async ({
	browser,
	request,
	baseURL,
}, testInfo) => {
	const { page, title, trigger, settings } = await createDisposableWishlist(
		browser,
		request,
		baseURL!,
		'dirty-save-continue',
	);
	const savedTitle = `${title} uloženo`;
	await settings.getByRole('textbox', { name: 'Název' }).fill(savedTitle);
	await page.keyboard.press('Escape');
	const guard = page.getByRole('dialog', { name: UNSAVED_NAME });
	await waitForSurfaceMotionToSettle(guard);

	const samples = await recordDialogExit(page, [settings, guard], async () => {
		await guard.getByRole('button', { name: 'Uložit a pokračovat' }).click();
	});

	expectSmoothDialogExit(samples);
	await expect(page.getByRole('heading', { level: 1 })).toContainText(savedTitle);
	await expectModalCleanup(page, trigger, { requireRestoredFocus: false });
	await attachSamples(testInfo, 'dirty-save-continue', samples);
	await page.context().close();
});

test('reduced motion tears down the dirty discard prompt and restores the page', async ({
	browser,
	request,
	baseURL,
}, testInfo) => {
	const page = await registerAndGetPage(
		browser,
		request,
		baseURL!,
		createTestUser('reduced-dirty-discard'),
	);
	await page.emulateMedia({ reducedMotion: 'reduce' });
	const title = 'Přechody nastavení reduced dirty discard';
	await createWishlistAndNavigate(page, title);
	await page.setViewportSize({ width: 1100, height: 720 });
	const trigger = page.getByRole('button', { name: SETTINGS_NAME });
	await trigger.click();
	const settings = page.getByRole('dialog', { name: SETTINGS_NAME });
	await settings.getByRole('textbox', { name: 'Název' }).fill(`${title} zahodit`);
	await page.keyboard.press('Escape');
	const guard = page.getByRole('dialog', { name: UNSAVED_NAME });
	await waitForSurfaceMotionToSettle(guard);
	const samples = await recordDialogExit(page, [settings, guard], async () => {
		await guard.getByRole('button', { name: 'Zahodit změny' }).click();
	});

	await attachSamples(testInfo, 'reduced-dirty-discard', samples);
	for (const surfaceSamples of [...samples.contents, ...samples.overlays]) {
		expectReducedMotionDirectExit(surfaceSamples);
	}
	await expectModalCleanup(page, trigger, { requireRestoredFocus: false });
	await page.context().close();
});

for (const reducedMotion of [false, true]) {
	test(`mobile Display sheet directly unmounts without flash with ${
		reducedMotion ? 'reduced' : 'normal'
	} motion`, async ({ browser, request, baseURL }, testInfo) => {
		const page = await registerAndGetPage(
			browser,
			request,
			baseURL!,
			createTestUser(`mobile-display-${reducedMotion ? 'reduced' : 'normal'}`),
		);
		await page.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
		await createWishlistAndNavigate(page, `Mobilní Display ${reducedMotion}`);
		await page.setViewportSize({ width: 390, height: 600 });
		const trigger = page.getByTestId('mobile-display-trigger');
		await trigger.click();
		const sheet = page.getByRole('dialog', { name: 'Zobrazení' });
		await waitForSurfaceMotionToSettle(sheet);
		const overlay = page.locator('[data-slot="sheet-overlay"]:visible');
		const [contentHandle, overlayHandle] = await Promise.all([
			startTransitionObservation(sheet),
			startTransitionObservation(overlay),
		]);

		await page.keyboard.press('Escape');
		await expect(sheet).toHaveCount(0);
		await expect(overlay).toHaveCount(0);
		const [contentSamples, overlaySamples] = await Promise.all([
			finishTransitionObservation(page, contentHandle),
			finishTransitionObservation(page, overlayHandle),
		]);
		expectDirectUnmountWithoutFlash(contentSamples);
		expectDirectUnmountWithoutFlash(overlaySamples);
		await expectModalCleanup(page, trigger);
		await attachSamples(testInfo, `mobile-display-${reducedMotion ? 'reduced' : 'normal'}`, {
			contents: [contentSamples],
			overlays: [overlaySamples],
		});
		await page.context().close();
	});
}
