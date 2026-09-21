import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const outputDirectory = join(process.cwd(), '.local', 'connected-view-switcher');
await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch();
const failures = [];
const closeTo = (actual, expected, message) =>
	assert(Math.abs(actual - expected) < 0.1, `${message}: ${actual} != ${expected}`);
const elementBox = (element) => {
	const rectangle = element.getBoundingClientRect();
	return {
		x: rectangle.x,
		y: rectangle.y,
		width: rectangle.width,
		height: rectangle.height,
	};
};
const measureControls = (toolbar) => {
	const toolbarRectangle = toolbar.getBoundingClientRect();
	return [...toolbar.querySelectorAll('button,[data-switcher]')].map((element) => {
		const rectangle = element.getBoundingClientRect();
		const style = getComputedStyle(element);
		return {
			testid: element.dataset.testid ?? null,
			label: element.getAttribute('aria-label'),
			x: rectangle.x - toolbarRectangle.x,
			y: rectangle.y - toolbarRectangle.y,
			width: rectangle.width,
			height: rectangle.height,
			font: style.font,
			radius: style.borderRadius,
		};
	});
};
const visualState = (element) => {
	const rectangle = element.getBoundingClientRect();
	const style = getComputedStyle(element);
	return {
		x: rectangle.x,
		y: rectangle.y,
		width: rectangle.width,
		height: rectangle.height,
		shadow: style.boxShadow,
		translate: style.translate,
		scale: style.scale,
	};
};
const pseudoFace = (element) => {
	const rectangle = element.getBoundingClientRect();
	const style = getComputedStyle(element, '::before');
	const left = rectangle.left + Number.parseFloat(style.left);
	const top = rectangle.top + Number.parseFloat(style.top);
	return {
		left,
		right: left + Number.parseFloat(style.width),
		top,
		bottom: top + Number.parseFloat(style.height),
		width: Number.parseFloat(style.width),
		height: Number.parseFloat(style.height),
		borderWidth: style.borderTopWidth,
		borderStyle: style.borderTopStyle,
		borderColor: style.borderTopColor,
		radius: style.borderRadius,
	};
};
const buttonFace = (element) => {
	const rectangle = element.getBoundingClientRect();
	const style = getComputedStyle(element);
	return {
		width: rectangle.width,
		height: rectangle.height,
		borderWidth: style.borderTopWidth,
		borderStyle: style.borderTopStyle,
		borderColor: style.borderTopColor,
		radius: style.borderRadius,
	};
};
const iconBoxes = (elements) =>
	elements.map((element) => {
		const rectangle = element.getBoundingClientRect();
		return [rectangle.x, rectangle.y, rectangle.width, rectangle.height];
	});

try {
	const defaultPage = await browser.newPage({ viewport: { width: 900, height: 700 } });
	await defaultPage.goto(new URL('refined.html', import.meta.url).href);
	assert.equal(await defaultPage.locator('body').getAttribute('data-device'), 'mobile');
	assert.match((await defaultPage.locator('iframe').getAttribute('src')) ?? '', /device=mobile/);
	await defaultPage.close();

	for (const device of ['mobile', 'desktop']) {
		const page = await browser.newPage({
			viewport: { width: 1600, height: 900 },
			reducedMotion: 'reduce',
		});
		page.on('pageerror', (error) => failures.push(`${device}: ${error.message}`));
		page.on('requestfailed', (request) => failures.push(`${device}: ${request.url()}`));
		await page.goto(new URL(`refined.html?device=${device}`, import.meta.url).href);
		const frameElement = page.locator('iframe');
		await frameElement.waitFor();
		const frame = page.frames().find((candidate) => candidate.url().includes('preview.html'));
		assert(frame, `${device}: preview iframe loaded`);
		const toolbar = frame.locator('[data-testid="wishlist-toolbar"]');
		await toolbar.waitFor();
		await frame.evaluate(() => document.fonts.ready);

		assert.equal(await page.locator('[data-device-link]').count(), 2, 'Both device links');
		assert.equal(
			await page.locator(`[data-device-link="${device}"]`).getAttribute('aria-current'),
			'page',
			'Current device link',
		);
		assert.equal(
			await frame.locator('[data-baseline], [data-proposed]').count(),
			0,
			'No baseline/comparison DOM',
		);
		assert.equal(
			await frame.locator('[data-testid="wishlist-toolbar"]').count(),
			1,
			'Single final toolbar',
		);
		assert(
			await frame.evaluate(() => document.documentElement.scrollHeight <= innerHeight),
			'Single toolbar fits the canonical iframe height',
		);
		const source = await frame.evaluate((key) => window.toolbarReference[key], device);
		assert.equal(
			await toolbar.getAttribute('data-palette'),
			source.palette,
			'Captured contextual palette',
		);
		const switcher = toolbar.locator('[data-switcher]');
		const segments = switcher.locator(':scope > button[data-segment]');
		const surface = switcher.locator(':scope > [data-proposal-surface]');
		assert.equal(await segments.count(), 2, 'Two semantic choices');
		assert.equal(await switcher.getAttribute('role'), 'group');
		for (const segment of await segments.all())
			assert.equal(await segment.getAttribute('role'), 'radio');

		const widths = device === 'mobile' ? [320, 390, 430] : [1024, 1280, 1440];
		const defaultWidth = device === 'mobile' ? 390 : 1280;
		for (const width of widths) {
			await page.locator('[data-width-control]').selectOption(String(width));
			await page.waitForFunction(
				({ selector, expected }) =>
					document.querySelector(selector)?.clientWidth === expected,
				{ selector: 'iframe', expected: width },
			);
			assert.equal(await frame.evaluate(() => innerWidth), width, 'Unscaled iframe width');
			const toolbarBox = await toolbar.boundingBox();
			const actualMetrics = await toolbar.evaluate(measureControls);
			assert.equal(actualMetrics.length, source.controls.length, 'Captured control count');
			const toolbarWidthDelta = toolbarBox.width - source.toolbar.width;
			for (const [index, actual] of actualMetrics.entries()) {
				const expected = source.controls[index];
				const followsRightEdge = index >= source.controls.length - 2;
				const expectedX = expected.x + (followsRightEdge ? toolbarWidthDelta : 0);
				closeTo(actual.x, expectedX, `${device}/${width} control ${index} x`);
				for (const key of ['y', 'width', 'height']) {
					closeTo(
						actual[key],
						expected[key],
						`${device}/${width} control ${index} ${key}`,
					);
				}
				assert.equal(actual.font, expected.font, 'Captured font and line-height');
				assert.equal(actual.radius, expected.radius, 'Captured radius');
			}

			for (const dark of [false, true]) {
				const currentlyDark = await page.evaluate(() =>
					document.documentElement.classList.contains('dark'),
				);
				if (currentlyDark !== dark) await page.locator('[data-mode-control]').click();
				for (const depth of ['soft', 'ink', 'black']) {
					await page.locator('[data-depth-control]').selectOption(depth);
					await frame.waitForFunction(
						({ expectedDark, expectedDepth }) =>
							document.documentElement.classList.contains('dark') === expectedDark &&
							document.documentElement.dataset.depth === expectedDepth,
						{ expectedDark: dark, expectedDepth: depth },
					);
					assert(
						await frame.evaluate(
							() => document.documentElement.scrollWidth <= innerWidth,
						),
						`${device}/${width}/${depth}/${dark ? 'dark' : 'light'} has no overflow`,
					);
					const neighbor = toolbar.locator(
						device === 'mobile'
							? '[data-testid="mobile-more-trigger"] > .elevation-surface'
							: '[data-testid="desktop-more-trigger"] > .elevation-surface',
					);
					assert.equal(
						await surface.evaluate((element) => getComputedStyle(element).boxShadow),
						await neighbor.evaluate((element) => getComputedStyle(element).boxShadow),
						'Shared resting shadow token',
					);
				}
			}
		}

		await page.locator('[data-width-control]').selectOption(String(defaultWidth));
		await page.locator('[data-depth-control]').selectOption('ink');
		if (await page.evaluate(() => document.documentElement.classList.contains('dark'))) {
			await page.locator('[data-mode-control]').click();
		}
		await frame.waitForFunction(() => !document.documentElement.classList.contains('dark'));
		const neighbor = toolbar.locator(
			device === 'mobile'
				? '[data-testid="mobile-more-trigger"] > .elevation-surface'
				: '[data-testid="desktop-more-trigger"] > .elevation-surface',
		);
		const expectedFace = await neighbor.evaluate(buttonFace);
		for (const option of await segments.all()) {
			await option.click();
			assert.equal(
				await switcher.locator('[aria-checked="true"]').count(),
				1,
				'One checked choice',
			);
			assert.equal(
				await switcher.locator('[aria-pressed="true"]').count(),
				1,
				'One pressed choice',
			);
			const selected = surface.locator(':scope > [data-state="on"]');
			const selectedFace = await selected.evaluate(pseudoFace);
			assert.deepEqual(
				{
					width: selectedFace.width,
					height: selectedFace.height,
					borderWidth: selectedFace.borderWidth,
					borderStyle: selectedFace.borderStyle,
					borderColor: selectedFace.borderColor,
					radius: selectedFace.radius,
				},
				expectedFace,
				`${device}: selected face exactly matches icon-only Button`,
			);
			const backing = await surface.evaluate(elementBox);
			const firstSelected =
				(await option.getAttribute('data-value')) ===
				(await segments.first().getAttribute('data-value'));
			closeTo(
				firstSelected ? selectedFace.left : selectedFace.right,
				firstSelected ? backing.x : backing.x + backing.width,
				`${device}: backing is flush on selected side`,
			);
			const inactive = surface.locator(':scope > [data-state="off"]');
			assert.deepEqual(
				await inactive.evaluate((element) => {
					const style = getComputedStyle(element);
					return [
						style.borderTopWidth,
						style.borderRightWidth,
						style.borderBottomWidth,
						style.borderLeftWidth,
					];
				}),
				['0px', '0px', '0px', '0px'],
				'Inactive choice has no border or divider',
			);
			assert.equal(
				await inactive.evaluate((element) => getComputedStyle(element, '::before').content),
				'none',
				'Inactive choice has no pseudo frame',
			);
			assert.deepEqual(
				await surface.evaluate((element) => {
					const style = getComputedStyle(element);
					return [
						style.borderTopWidth,
						style.borderRightWidth,
						style.borderBottomWidth,
						style.borderLeftWidth,
					];
				}),
				['0px', '0px', '0px', '0px'],
				'Backing has no outer border',
			);
			assert.equal(
				await surface.evaluate((element) => getComputedStyle(element, '::before').content),
				'none',
				'No outer pseudo frame',
			);
			assert.deepEqual(
				await surface.locator('svg').evaluateAll(iconBoxes),
				await segments.locator('svg').evaluateAll(iconBoxes),
				'Tray icons align with real hit-target icons',
			);
		}

		await segments.first().click();
		await segments.first().press('ArrowRight');
		assert(await segments.last().evaluate((element) => element === document.activeElement));
		assert.equal(await segments.last().getAttribute('aria-checked'), 'true');
		await segments.last().press('ArrowLeft');
		assert(await segments.first().evaluate((element) => element === document.activeElement));
		await segments.first().press('End');
		assert(await segments.last().evaluate((element) => element === document.activeElement));
		await segments.last().press('Home');
		assert(await segments.first().evaluate((element) => element === document.activeElement));
		assert.equal(
			await segments.first().evaluate((element) => getComputedStyle(element).outlineWidth),
			'2px',
			'Keyboard focus remains visible',
		);

		for (const reducedMotion of ['no-preference', 'reduce']) {
			await page.emulateMedia({ reducedMotion });
			await page.mouse.move(0, 0);
			await frame.evaluate(() => document.activeElement?.blur());
			const ownerBefore = await switcher.evaluate(elementBox);
			const hitBefore = await segments.first().evaluate(elementBox);
			const surfaceBefore = await surface.evaluate(visualState);
			const selectedBefore = await surface
				.locator(':scope > [data-state="on"]')
				.evaluate(pseudoFace);
			await segments.first().hover();
			await page.waitForTimeout(250);
			assert.deepEqual(
				await switcher.evaluate(elementBox),
				ownerBefore,
				`${reducedMotion}: stable owner hover`,
			);
			assert.deepEqual(
				await segments.first().evaluate(elementBox),
				hitBefore,
				`${reducedMotion}: stable hit hover`,
			);
			assert.deepEqual(
				await surface.evaluate(visualState),
				surfaceBefore,
				`${reducedMotion}: static visual hover`,
			);
			assert.deepEqual(
				await surface.locator(':scope > [data-state="on"]').evaluate(pseudoFace),
				selectedBefore,
				`${reducedMotion}: stable selected face hover`,
			);
			await page.mouse.down();
			await page.waitForTimeout(250);
			assert.deepEqual(
				await switcher.evaluate(elementBox),
				ownerBefore,
				`${reducedMotion}: stable owner press`,
			);
			assert.deepEqual(
				await segments.first().evaluate(elementBox),
				hitBefore,
				`${reducedMotion}: stable hit press`,
			);
			assert.deepEqual(
				await surface.evaluate(visualState),
				surfaceBefore,
				`${reducedMotion}: static visual press`,
			);
			await page.mouse.up();
		}

		for (const dark of [false, true]) {
			const currentlyDark = await page.evaluate(() =>
				document.documentElement.classList.contains('dark'),
			);
			if (currentlyDark !== dark) await page.locator('[data-mode-control]').click();
			await frame.waitForFunction(
				(expectedDark) =>
					document.documentElement.classList.contains('dark') === expectedDark,
				dark,
			);
			await frameElement.screenshot({
				path: join(outputDirectory, `final-${device}${dark ? '-dark' : ''}.png`),
			});
		}
		console.log(
			`PASS ${device}: canonical widths, depths, themes, capture geometry, static visuals, selection, keyboard`,
		);
		await page.close();
	}
	assert.deepEqual(failures, [], 'Asset/runtime errors');
} finally {
	await browser.close();
}
