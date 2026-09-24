import { expect, test } from '@playwright/test';
import { createPixelAssertions, DEFAULT_PIXEL_TOLERANCE } from '../helpers/pixel-assertions.mjs';

const { expectPixelsNear } = createPixelAssertions(expect);

const CONTROL_SIZES = {
	sm: 26,
	md: 32,
	lg: 40,
	xl: 48,
} as const;

test('playground presents every explicit control size with compatible real peers', async ({
	page,
}) => {
	await page.goto('/playground');

	const showcase = page.getByTestId('control-sizing-showcase');
	await expect(showcase).toBeVisible();

	for (const [size, expectedHeight] of Object.entries(CONTROL_SIZES)) {
		const row = showcase.locator(`[data-size-row="${size}"]`);
		await expect(row).toBeVisible();

		for (const peer of await row.locator('[data-control-peer]').all()) {
			await expect
				.poll(async () =>
					Math.abs(
						(await peer.evaluate((element) => element.getBoundingClientRect().height)) -
							expectedHeight,
					),
				)
				.toBeLessThanOrEqual(DEFAULT_PIXEL_TOLERANCE);
			await expect(peer).not.toHaveAttribute('style', /height|radius|shadow/i);
		}

		for (const shellTrigger of await row.locator('[data-shell-peers] button').all()) {
			await expect
				.poll(async () =>
					Math.abs(
						(await shellTrigger.evaluate(
							(element) => element.getBoundingClientRect().height,
						)) - expectedHeight,
					),
				)
				.toBeLessThanOrEqual(DEFAULT_PIXEL_TOLERANCE);
		}

		for (const peerGroup of await row.locator('[data-peer-group], [data-shell-peers]').all()) {
			await expect
				.poll(() => peerGroup.evaluate((element) => getComputedStyle(element).columnGap))
				.toBe('8px');
		}

		const iconWidths = await row
			.locator('[data-peer-group="core"] [data-icon]')
			.evaluateAll((icons) => icons.map((icon) => icon.getBoundingClientRect().width));
		expectPixelsNear(Math.max(...iconWidths), Math.min(...iconWidths));
	}
});

test('default controls respond by breakpoint and the showcase does not overflow', async ({
	page,
}) => {
	await page.goto('/playground');
	const responsiveRow = page.locator('[data-default-responsive-row]');
	const responsivePeers = responsiveRow.locator('[data-responsive-peer]');

	for (const [width, expectedHeight] of [
		[390, 40],
		[1280, 32],
	] as const) {
		await page.setViewportSize({ width, height: 900 });
		for (const peer of await responsivePeers.all()) {
			await expect
				.poll(async () =>
					Math.abs(
						(await peer.evaluate((element) => element.getBoundingClientRect().height)) -
							expectedHeight,
					),
				)
				.toBeLessThanOrEqual(DEFAULT_PIXEL_TOLERANCE);
		}
		for (const shellTrigger of await responsiveRow
			.locator('[data-responsive-shell] button')
			.all()) {
			await expect
				.poll(async () =>
					Math.abs(
						(await shellTrigger.evaluate(
							(element) => element.getBoundingClientRect().height,
						)) - expectedHeight,
					),
				)
				.toBeLessThanOrEqual(DEFAULT_PIXEL_TOLERANCE);
		}
		await expect(
			responsiveRow.getByRole('group', { name: 'Default segmented toggle' }),
		).toBeVisible();
		await expect
			.poll(() =>
				page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
			)
			.toBe(true);
	}
});
