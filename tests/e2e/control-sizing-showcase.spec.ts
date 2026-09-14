import { expect, test } from '@playwright/test';
import { waitForAppHydration } from './fixtures/auth-helpers.js';

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

test('showcase compares real ghost and sticker LikeButtons at every control size', async ({
	page,
}) => {
	await page.goto('/playground');
	const showcase = page.getByTestId('control-sizing-showcase');

	for (const [size, expectedHeight] of Object.entries(CONTROL_SIZES)) {
		const row = showcase.locator(`[data-size-row="${size}"]`);
		const likeButtons = row.locator('[data-like-treatment] button');
		await expect(likeButtons).toHaveCount(2);
		await expect(row.locator('[data-like-treatment="ghost"] button')).toHaveAccessibleName(
			new RegExp(`(favorites|oblíbených).*${size} ghost`, 'i'),
		);
		await expect(row.locator('[data-like-treatment="sticker"] button')).toHaveAccessibleName(
			new RegExp(`(favorites|oblíbených).*${size} sticker`, 'i'),
		);

		for (const likeButton of await likeButtons.all()) {
			await expect
				.poll(() =>
					likeButton.evaluate((element) => element.getBoundingClientRect().height),
				)
				.toBe(expectedHeight);
		}

		const peerIconWidths = await row
			.locator('[data-peer-group="core"] [data-icon], [data-like-treatment] svg')
			.evaluateAll((icons) => icons.map((icon) => icon.getBoundingClientRect().width));
		expect(new Set(peerIconWidths).size).toBe(1);
	}

	const responsiveRow = showcase.locator('[data-default-responsive-row]');
	for (const [width, expectedHeight] of [
		[390, 40],
		[1280, 32],
	] as const) {
		await page.setViewportSize({ width, height: 900 });
		const likeButtons = responsiveRow.locator('[data-like-treatment] button');
		await expect(likeButtons).toHaveCount(2);
		for (const likeButton of await likeButtons.all()) {
			await expect
				.poll(() =>
					likeButton.evaluate((element) => element.getBoundingClientRect().height),
				)
				.toBe(expectedHeight);
		}
		const iconWidths = await responsiveRow
			.locator('[data-like-treatment] svg')
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

test('showcase selects a real option from the sized Select with the keyboard', async ({ page }) => {
	await page.goto('/playground');
	await waitForAppHydration(page);
	const select = page.getByRole('button', { name: 'md select' });

	await select.click();
	await expect(page.getByRole('listbox')).toBeVisible();
	await page.keyboard.press('ArrowDown');
	await page.keyboard.press('Enter');

	await expect(select).toContainText('Two');
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

test('real appearance preferences give each depth a distinct shared shadow without changing geometry', async ({
	page,
}) => {
	await page.goto('/playground');
	await waitForAppHydration(page);
	const html = page.locator('html');
	const row = page.locator('[data-size-row="md"]');
	const modeButton = page.getByRole('button', {
		name: /^(Light|Dark|System) mode$|^(Světlý|Tmavý|Systémový) režim$/,
	});
	const modeLabels = {
		light: /^Light mode$|^Světlý režim$/,
		dark: /^Dark mode$|^Tmavý režim$/,
		system: /^System mode$|^Systémový režim$/,
	} as const;
	const depthLabels = {
		soft: /^(Soft|Jemné)$/,
		ink: /^(Ink|Inkoustové)$/,
		black: /^(Black|Černé)$/,
	} as const;
	const geometries: string[] = [];

	async function chooseMode(target: 'light' | 'dark') {
		if (
			await modeButton
				.getAttribute('aria-label')
				.then((label) => modeLabels[target].test(label ?? ''))
		) {
			return;
		}
		const currentIsSystem = await modeButton
			.getAttribute('aria-label')
			.then((label) => modeLabels.system.test(label ?? ''));
		const clicks = currentIsSystem ? (target === 'light' ? 1 : 2) : target === 'dark' ? 1 : 2;
		for (let click = 0; click < clicks; click += 1) {
			await modeButton.click();
		}
		await expect(modeButton).toHaveAccessibleName(modeLabels[target]);
		await expect(html).toHaveClass(target === 'dark' ? /\bdark\b/ : /^(?!.*\bdark\b)/);
	}

	for (const colorMode of ['light', 'dark'] as const) {
		await chooseMode(colorMode);
		const shadows: string[] = [];

		for (const depth of ['soft', 'ink', 'black'] as const) {
			await page.getByRole('radio', { name: depthLabels[depth] }).click();
			await expect(html).toHaveAttribute('data-depth', depth);
			await expect
				.poll(() =>
					row.evaluate((element) => element.getAnimations({ subtree: true }).length),
				)
				.toBe(0);

			const result = await row.evaluate((element) => {
				const button = element.querySelector(
					'button[data-control-peer]:not([aria-label]) > [data-slot="elevation-surface"]',
				);
				const select = element.querySelector(
					'[data-slot="select-trigger"] > [data-slot="elevation-surface"]',
				);
				if (!(button instanceof HTMLElement) || !(select instanceof HTMLElement)) {
					throw new Error('Raised Button and Select surfaces are required');
				}
				const buttonStyles = getComputedStyle(button);
				const selectStyles = getComputedStyle(select);
				const buttonHeight = button.parentElement?.getBoundingClientRect().height;
				const selectHeight = select.parentElement?.getBoundingClientRect().height;
				return {
					geometry: {
						buttonHeight,
						selectHeight,
						buttonRadius: buttonStyles.borderRadius,
						selectRadius: selectStyles.borderRadius,
					},
					buttonShadow: buttonStyles.boxShadow,
					selectShadow: selectStyles.boxShadow,
				};
			});

			expect(result.buttonShadow).not.toBe('none');
			expect(result.selectShadow).toBe(result.buttonShadow);
			expect(result.geometry.buttonHeight).toBe(32);
			expect(result.geometry.selectHeight).toBe(32);
			expect(result.geometry.buttonRadius).toBe(result.geometry.selectRadius);
			shadows.push(result.buttonShadow);
			geometries.push(JSON.stringify(result.geometry));
		}

		expect(new Set(shadows).size, `Computed ${colorMode} shadows: ${shadows.join(' | ')}`).toBe(
			3,
		);
	}

	expect(new Set(geometries).size).toBe(1);
});

test('state examples expose checked, mixed, disabled, error, pending, and keyboard focus states', async ({
	page,
}) => {
	await page.setViewportSize({ width: 390, height: 900 });
	await page.goto('/playground');
	const states = page.locator('[data-state-examples]');

	await expect(states.getByRole('checkbox', { name: 'Checked checkbox' })).toBeChecked();
	await expect(states.getByRole('checkbox', { name: 'Mixed checkbox' })).toHaveAttribute(
		'aria-checked',
		'mixed',
	);
	await expect(states.getByRole('checkbox', { name: 'Disabled checkbox' })).toBeDisabled();
	await expect(states.getByRole('textbox', { name: 'Error input' })).toHaveAttribute(
		'aria-invalid',
		'true',
	);
	await expect(states.getByRole('button', { name: 'Pending action' })).toBeDisabled();
	const focusExample = states.getByRole('button', { name: 'Focus with keyboard' });
	await states.getByRole('textbox', { name: 'Error input' }).click();
	await page.keyboard.press('Tab');
	await expect(focusExample).toBeFocused();
	expect(await focusExample.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
	const focusOutline = await focusExample.evaluate((element) => {
		const style = getComputedStyle(element);
		return {
			style: style.outlineStyle,
			width: Number.parseFloat(style.outlineWidth),
			color: style.outlineColor,
		};
	});
	expect(focusOutline.style).not.toBe('none');
	expect(focusOutline.width).toBeGreaterThan(0);
	expect(focusOutline.color).not.toBe('rgba(0, 0, 0, 0)');
	await expect
		.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
		.toBe(true);
});
