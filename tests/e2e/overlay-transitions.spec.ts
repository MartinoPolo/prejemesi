import { writeFile } from 'node:fs/promises';
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import {
	loginViaApi,
	parseCookiesForContext,
	waitForAppHydration,
} from './fixtures/auth-helpers.js';

const WISHLIST_PATH = '/w/xmas2026';
const REPRESENTATIVE_GIFT = {
	name: 'PlayStation 5',
	description: 'Nejnovější verze, s mechanikou na disky',
} as const;
const TRANSITION_PROBE_KEY = '__giftModalTransitionProbe';

interface TransitionSample {
	timestamp: number;
	source: 'initial' | 'animation-frame' | 'mutation';
	closing: boolean;
	connected: boolean;
	visible: boolean;
	state: string | null;
	heading: string | null;
	hasDescription: boolean;
	hasGiftForm: boolean;
}

async function openWishlistAsVisitor(
	page: Page,
	request: Parameters<typeof loginViaApi>[0],
	baseURL: string,
) {
	const cookies = await loginViaApi(request, baseURL, {
		email: 'petr@test.cz',
		password: ['password', '123'].join(''),
	});
	await page.context().addCookies(parseCookiesForContext(cookies, baseURL));
	await page.goto(WISHLIST_PATH, { waitUntil: 'domcontentloaded' });
	await expect(page.locator('[data-gift-item]').first()).toBeVisible();
	await waitForAppHydration(page);
}

async function startTransitionProbe(page: Page, dialog: Locator) {
	await dialog.evaluate(
		(element, probeConfiguration) => {
			const records: TransitionSample[] = [];
			const probe = { closing: false, records };
			Object.defineProperty(window, probeConfiguration.key, {
				value: probe,
				configurable: true,
			});

			function sample(source: TransitionSample['source']) {
				const bounds = element.getBoundingClientRect();
				const style = getComputedStyle(element);
				const heading = element.querySelector('h2');
				records.push({
					timestamp: performance.now(),
					source,
					closing: probe.closing,
					connected: element.isConnected,
					visible:
						element.isConnected &&
						bounds.width > 0 &&
						bounds.height > 0 &&
						style.visibility !== 'hidden' &&
						Number.parseFloat(style.opacity) > 0.01,
					state: element.getAttribute('data-state'),
					heading: heading?.textContent?.trim() ?? null,
					hasDescription:
						element.textContent?.includes(probeConfiguration.description) ?? false,
					hasGiftForm: element.querySelector('[data-testid="gift-detail-body"]') !== null,
				});
			}

			const observer = new MutationObserver(() => sample('mutation'));
			observer.observe(element, { attributes: true, childList: true, subtree: true });
			sample('initial');

			function sampleAnimationFrame() {
				sample('animation-frame');
				if (element.isConnected) {
					requestAnimationFrame(sampleAnimationFrame);
				} else {
					observer.disconnect();
				}
			}
			requestAnimationFrame(sampleAnimationFrame);
		},
		{
			key: TRANSITION_PROBE_KEY,
			description: REPRESENTATIVE_GIFT.description,
		},
	);
}

async function openRepresentativeGift(page: Page) {
	const giftItem = page.locator('[data-gift-item]').filter({
		has: page.getByRole('heading', { name: REPRESENTATIVE_GIFT.name, exact: true }),
	});
	await giftItem.focus();
	await page.keyboard.press('Enter');

	const dialog = page.getByRole('dialog').filter({
		has: page.getByRole('heading', { name: REPRESENTATIVE_GIFT.name, exact: true }),
	});
	await expect(dialog).toBeVisible();
	await expect(dialog).toContainText(REPRESENTATIVE_GIFT.description);
	await expect(dialog.getByTestId('gift-detail-body')).toHaveCount(0);
	return { giftItem, dialog };
}

async function readTransitionTimeline(page: Page): Promise<TransitionSample[]> {
	return page.evaluate(
		(key): TransitionSample[] => Reflect.get(window, key).records,
		TRANSITION_PROBE_KEY,
	);
}

function unstableVisibleSamples(timeline: readonly TransitionSample[]) {
	return timeline.filter(
		(sample) =>
			sample.closing &&
			sample.visible &&
			(sample.heading !== REPRESENTATIVE_GIFT.name ||
				!sample.hasDescription ||
				sample.hasGiftForm),
	);
}

async function expectStableGiftExit(options: {
	page: Page;
	giftItem: Locator;
	dialog: Locator;
	testInfo: TestInfo;
	evidenceName: string;
	dismiss: () => Promise<void>;
	requireVisibleExit?: boolean;
}) {
	const {
		page,
		giftItem,
		dialog,
		testInfo,
		evidenceName,
		dismiss,
		requireVisibleExit = true,
	} = options;
	await startTransitionProbe(page, dialog);
	await page.evaluate((key) => {
		Reflect.get(window, key).closing = true;
	}, TRANSITION_PROBE_KEY);

	await dismiss();
	await page.screenshot({ path: testInfo.outputPath(`${evidenceName}.png`) });
	await expect(dialog).toBeHidden();
	await expect(page.locator('[data-slot="dialog-overlay"]')).toHaveCount(0);
	await expect(giftItem).toBeFocused();
	await page.waitForTimeout(250);
	await expect(page.getByRole('dialog')).toHaveCount(0);

	const timeline = await readTransitionTimeline(page);
	await writeFile(testInfo.outputPath(`${evidenceName}.json`), JSON.stringify(timeline, null, 2));
	if (requireVisibleExit) {
		expect(timeline.some((sample) => sample.closing && sample.visible)).toBe(true);
	}
	expect(unstableVisibleSamples(timeline)).toEqual([]);
}

test.describe('issue #378 gift modal teardown', () => {
	test.beforeEach(async ({ page, request, baseURL }) => {
		await openWishlistAsVisitor(page, request, baseURL!);
	});

	test('Escape keeps the outgoing gift identity stable for every visible exit frame', async ({
		page,
	}, testInfo) => {
		const { giftItem, dialog } = await openRepresentativeGift(page);
		await expectStableGiftExit({
			page,
			giftItem,
			dialog,
			testInfo,
			evidenceName: 'gift-modal-escape-exit',
			dismiss: () => page.keyboard.press('Escape'),
		});
	});

	test('the close button keeps the outgoing gift identity stable through its exit', async ({
		page,
	}, testInfo) => {
		const { giftItem, dialog } = await openRepresentativeGift(page);
		await expectStableGiftExit({
			page,
			giftItem,
			dialog,
			testInfo,
			evidenceName: 'gift-modal-close-button-exit',
			dismiss: () => dialog.getByRole('button', { name: /Zavřít|Close/ }).click(),
		});
	});

	test('outside dismissal keeps the outgoing gift identity stable through its exit', async ({
		page,
	}, testInfo) => {
		const { giftItem, dialog } = await openRepresentativeGift(page);
		await expectStableGiftExit({
			page,
			giftItem,
			dialog,
			testInfo,
			evidenceName: 'gift-modal-outside-exit',
			dismiss: () =>
				page.locator('[data-slot="dialog-overlay"]').click({ position: { x: 5, y: 5 } }),
		});
	});

	test('a rapid reopen is not cleared by completion from the interrupted close', async ({
		page,
	}, testInfo) => {
		const { giftItem, dialog } = await openRepresentativeGift(page);
		await startTransitionProbe(page, dialog);
		await page.evaluate((key) => {
			Reflect.get(window, key).closing = true;
		}, TRANSITION_PROBE_KEY);

		await dialog.getByRole('button', { name: /Zavřít|Close/ }).click();
		await giftItem.focus();
		await page.keyboard.press('Enter');
		await expect(page.locator('[data-slot="dialog-content"]')).toHaveAttribute(
			'data-state',
			'open',
		);
		await page.waitForTimeout(300);
		await expect(dialog).toContainText(REPRESENTATIVE_GIFT.description);
		await expect(dialog.getByTestId('gift-detail-body')).toHaveCount(0);

		const timeline = await readTransitionTimeline(page);
		await writeFile(
			testInfo.outputPath('gift-modal-rapid-reopen.json'),
			JSON.stringify(timeline, null, 2),
		);
		expect(unstableVisibleSamples(timeline)).toEqual([]);

		await page.keyboard.press('Escape');
		await expect(dialog).toBeHidden();
		await expect(page.locator('[data-slot="dialog-overlay"]')).toHaveCount(0);
	});

	test('reduced motion keeps gift identity stable while closing', async ({ page }, testInfo) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		const { giftItem, dialog } = await openRepresentativeGift(page);
		await expectStableGiftExit({
			page,
			giftItem,
			dialog,
			testInfo,
			evidenceName: 'gift-modal-reduced-motion-exit',
			dismiss: () => page.keyboard.press('Escape'),
			requireVisibleExit: false,
		});
	});
});
