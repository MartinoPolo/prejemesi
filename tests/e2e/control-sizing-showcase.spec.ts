import { expect, test } from '@playwright/test';

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
				.poll(() => peer.evaluate((element) => element.getBoundingClientRect().height))
				.toBe(expectedHeight);
			await expect(peer).not.toHaveAttribute('style', /height|radius|shadow/i);
		}

		for (const shellTrigger of await row.locator('[data-shell-peers] button').all()) {
			await expect
				.poll(() =>
					shellTrigger.evaluate((element) => element.getBoundingClientRect().height),
				)
				.toBe(expectedHeight);
		}

		for (const peerGroup of await row.locator('[data-peer-group], [data-shell-peers]').all()) {
			await expect
				.poll(() => peerGroup.evaluate((element) => getComputedStyle(element).columnGap))
				.toBe('8px');
		}

		const iconWidths = await row
			.locator('[data-peer-group="core"] [data-icon]')
			.evaluateAll((icons) => icons.map((icon) => icon.getBoundingClientRect().width));
		expect(new Set(iconWidths).size).toBe(1);
	}
});

test('every explicit size row compares every button treatment in text and icon forms', async ({
	page,
}) => {
	await page.goto('/playground');
	const showcase = page.getByTestId('control-sizing-showcase');
	const expectedIntents = [
		'primary',
		'secondary',
		'ghost',
		'ghost-overlay',
		'danger',
		'primary-destructive',
		'outline',
		'link',
	];

	for (const [size, expectedHeight] of Object.entries(CONTROL_SIZES)) {
		const sizeRow = showcase.locator(`[data-size-row="${size}"]`);
		for (const intent of expectedIntents) {
			const treatment = sizeRow.locator(`[data-button-intent="${intent}"]`);
			const buttons = treatment.locator('button');
			await expect(buttons).toHaveCount(2);
			await expect(
				treatment.getByRole('button', { name: `${size} ${intent} icon treatment` }),
			).toBeVisible();
			for (const button of await buttons.all()) {
				await expect
					.poll(() =>
						button.evaluate((element) => element.getBoundingClientRect().height),
					)
					.toBe(expectedHeight);
			}
			await expect
				.poll(() => treatment.evaluate((element) => getComputedStyle(element).columnGap))
				.toBe('8px');
		}

		const iconWidths = await sizeRow
			.locator('[data-button-intent] button[aria-label$="icon treatment"] svg')
			.evaluateAll((icons) => icons.map((icon) => icon.getBoundingClientRect().width));
		expect(new Set(iconWidths).size).toBe(1);
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
				.poll(() => peer.evaluate((element) => element.getBoundingClientRect().height))
				.toBe(expectedHeight);
		}
		for (const shellTrigger of await responsiveRow
			.locator('[data-responsive-shell] button')
			.all()) {
			await expect
				.poll(() =>
					shellTrigger.evaluate((element) => element.getBoundingClientRect().height),
				)
				.toBe(expectedHeight);
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
