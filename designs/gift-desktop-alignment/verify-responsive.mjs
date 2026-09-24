import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { sharedChromeLaunchOptions } from '../../scripts/browser-automation.mjs';

const browser = await chromium.launch({ ...sharedChromeLaunchOptions, headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
const url = pathToFileURL(resolve('designs/gift-desktop-alignment/variants/responsive.html')).href;

async function settle() {
	await page.evaluate(() => document.fonts.ready);
	await page.waitForTimeout(100);
}

async function select(selector, value) {
	await page.locator(selector).selectOption(value);
	await settle();
}

function disjoint(first, second) {
	return (
		first.bottom <= second.top + 0.5 ||
		second.bottom <= first.top + 0.5 ||
		first.right <= second.left + 0.5 ||
		second.right <= first.left + 0.5
	);
}

async function assertNoPaintOverflow(label) {
	const result = await page.locator('.gift-card').evaluateAll((cards) =>
		cards.map((card) => {
			const bounds = card.getBoundingClientRect();
			const painted = card.querySelectorAll(
				'.gift-title,.description-row,.link-track,.price,.action-group,.category-badge,.priority-badge,.state-overlay,.reservation-identity,.like-button,.like-readonly',
			);
			const contained = [...painted].every((element) => {
				const rectangle = element.getBoundingClientRect();
				if (rectangle.width === 0 && rectangle.height === 0) return true;
				return (
					rectangle.left >= bounds.left - 1 &&
					rectangle.right <= bounds.right + 1 &&
					rectangle.top >= bounds.top - 1 &&
					rectangle.bottom <= bounds.bottom + 1
				);
			});
			const price = card.querySelector('.price').getBoundingClientRect();
			const actions = card.querySelector('.action-group').getBoundingClientRect();
			const priceActionsOverlap =
				price.left < actions.right - 0.5 &&
				price.right > actions.left + 0.5 &&
				price.top < actions.bottom - 0.5 &&
				price.bottom > actions.top + 0.5;
			return {
				gift: card.dataset.giftId,
				contained,
				priceActionsOverlap,
				card: bounds.toJSON(),
				painted: [...painted].map((element) => ({
					className: element.className,
					rectangle: element.getBoundingClientRect().toJSON(),
				})),
			};
		}),
	);
	assert.ok(
		result.every((item) => item.contained && !item.priceActionsOverlap),
		`${label}: visible content stays inside every card: ${JSON.stringify(result.filter((item) => !item.contained || item.priceActionsOverlap))}`,
	);
}

async function assertMobileListGeometry(label) {
	assert.ok(
		await page.locator('.gift-card').evaluateAll((cards) =>
			cards.every((card) => {
				const cardRectangle = card.getBoundingClientRect();
				const imageRectangle = card.querySelector('.image-area').getBoundingClientRect();
				return (
					Math.abs(imageRectangle.height - cardRectangle.height) <= 1 &&
					imageRectangle.width / cardRectangle.width <= 0.36 &&
					cardRectangle.width - imageRectangle.width >= 170 &&
					imageRectangle.height > imageRectangle.width
				);
			}),
		),
		`${label}: images are bounded portraits filling each row`,
	);

	const cards = page.locator('.gift-card');
	for (let cardIndex = 0; cardIndex < (await cards.count()); cardIndex += 1) {
		const card = cards.nth(cardIndex);
		const image = await card
			.locator('.image-area')
			.evaluate((element) => element.getBoundingClientRect().toJSON());
		const overlays = await card
			.locator(
				'.category-badge,.priority-badge,.state-overlay,.reservation-identity,.like-button,.like-readonly',
			)
			.evaluateAll((elements) =>
				elements.map((element) => element.getBoundingClientRect().toJSON()),
			);
		assert.ok(
			overlays.every(
				(overlay) =>
					overlay.left >= image.left - 1 &&
					overlay.right <= image.right + 1 &&
					overlay.top >= image.top - 1 &&
					overlay.bottom <= image.bottom + 1,
			),
			`${label}: every overlay remains fully visible inside the image strip`,
		);
		for (let firstIndex = 0; firstIndex < overlays.length; firstIndex += 1) {
			for (
				let secondIndex = firstIndex + 1;
				secondIndex < overlays.length;
				secondIndex += 1
			) {
				assert.ok(
					disjoint(overlays[firstIndex], overlays[secondIndex]),
					`${label}: every overlay pair is disjoint`,
				);
			}
		}
	}
	await assertNoPaintOverflow(label);
}

async function assertMobileTextClamps(label) {
	const results = await page.locator('.gift-card').evaluateAll((cards) =>
		cards.map((card) =>
			['.gift-title', '.description-row'].map((selector) => {
				const element = card.querySelector(selector);
				const rectangle = element.getBoundingClientRect();
				const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight);
				return rectangle.height <= lineHeight * 2 + 1;
			}),
		),
	);
	assert.ok(
		results.every((result) => result.every(Boolean)),
		`${label}: visible titles and descriptions occupy at most two lines`,
	);
}

async function assertGridOverlaySeparation(label) {
	const cards = page.locator('.gift-card');
	for (let cardIndex = 0; cardIndex < (await cards.count()); cardIndex += 1) {
		const card = cards.nth(cardIndex);
		const image = await card
			.locator('.image-area')
			.evaluate((element) => element.getBoundingClientRect().toJSON());
		const overlays = await card
			.locator(
				'.category-badge,.priority-badge,.state-overlay,.reservation-identity,.like-button,.like-readonly',
			)
			.evaluateAll((elements) =>
				elements.map((element) => element.getBoundingClientRect().toJSON()),
			);
		assert.ok(
			overlays.every(
				(overlay) =>
					overlay.left >= image.left - 1 &&
					overlay.right <= image.right + 1 &&
					overlay.top >= image.top - 1 &&
					overlay.bottom <= image.bottom + 1,
			),
			`${label}: overlays remain inside the grid image`,
		);
		for (let firstIndex = 0; firstIndex < overlays.length; firstIndex += 1) {
			for (
				let secondIndex = firstIndex + 1;
				secondIndex < overlays.length;
				secondIndex += 1
			) {
				assert.ok(
					disjoint(overlays[firstIndex], overlays[secondIndex]),
					`${label}: grid overlays are disjoint`,
				);
			}
		}
	}
}

async function assertTwoColumnTracks(label) {
	const tracks = await page.locator('.gift-card').evaluateAll((cards) =>
		cards.map((card) => {
			const cardRectangle = card.getBoundingClientRect();
			const relativeTop = (selector) =>
				card.querySelector(selector).getBoundingClientRect().top - cardRectangle.top;
			return {
				title: relativeTop('.name-row'),
				description: relativeTop('.description-row'),
				links: relativeTop('.link-track'),
				price: relativeTop('.price'),
				actions: relativeTop('.action-group'),
			};
		}),
	);
	for (const track of Object.keys(tracks[0])) {
		const values = tracks.map((item) => item[track]);
		assert.ok(
			Math.max(...values) - Math.min(...values) <= 1,
			`${label}: ${track} track aligns`,
		);
	}
	await assertNoPaintOverflow(label);
}

try {
	await page.goto(url);
	await settle();

	assert.ok(
		await page.locator('a[href="variant-a.html"]').count(),
		'approved desktop Grid baseline is linked',
	);
	const fontState = await page.evaluate(() => ({
		title: getComputedStyle(document.querySelector('.gift-title')).fontFamily,
		titleSize: Number.parseFloat(
			getComputedStyle(document.querySelector('.gift-title')).fontSize,
		),
		localFontSheets: [...document.styleSheets].some((sheet) =>
			sheet.href?.endsWith('/responsive.css'),
		),
	}));
	assert.match(fontState.title, /DynaPuff Variable/);
	assert.equal(fontState.titleSize, 24);
	assert.ok(fontState.localFontSheets);

	// Mobile regressions are exercised first because their geometry drove this refinement.
	await page.setViewportSize({ width: 320, height: 1000 });
	await select('#mode-control', 'mobile-grid');
	await select('#width-control', '320');
	await select('#columns-control', '2');
	await select('#role-control', 'manager');
	await assertMobileTextClamps('two-column Grid 320');
	const narrowActionHeight = await page
		.locator('#collection')
		.evaluate((node) =>
			Number.parseFloat(getComputedStyle(node).getPropertyValue('--grid-action-track')),
		);
	const headphonesActions = page.locator('[data-gift-id="headphones"] .action-group');
	assert.ok(
		await headphonesActions.getByRole('button', { name: 'Rezervovat' }).isVisible(),
		'narrow action lane keeps Reserve visible',
	);
	assert.equal(
		await headphonesActions.getByRole('button', { name: 'Přijato' }).isVisible(),
		false,
		'narrow action lane moves Received out of the visible row',
	);
	assert.ok(
		await headphonesActions.evaluate((group) => {
			const boxes = [...group.querySelectorAll('button:not([hidden])')].map((button) =>
				button.getBoundingClientRect(),
			);
			return (
				boxes.every((box) => Math.abs(box.top - boxes[0].top) <= 1) &&
				group.getBoundingClientRect().height <=
					Math.max(...boxes.map((box) => box.height)) + 1
			);
		}),
		'visible mobile actions share one visual row',
	);
	await headphonesActions.locator('.more-button').click();
	assert.ok(
		await page.getByRole('menuitem', { name: 'Přijato', exact: true }).isEnabled(),
		'overflowed Received remains pointer-accessible with its enabled state',
	);
	await page.keyboard.press('Escape');
	await select('#columns-control', '1');
	assert.ok(
		await headphonesActions.getByRole('button', { name: 'Přijato' }).isVisible(),
		'Received returns when the action lane widens',
	);
	await select('#columns-control', '2');
	await select('#role-control', 'recipient');
	assert.ok(
		await headphonesActions.getByRole('button', { name: 'Přijato' }).isVisible(),
		'a lone Received command stays visible while it truly fits beside More',
	);
	await select('#role-control', 'manager');
	assert.ok(
		Math.abs(
			(await page
				.locator('#collection')
				.evaluate((node) =>
					Number.parseFloat(
						getComputedStyle(node).getPropertyValue('--grid-action-track'),
					),
				)) - narrowActionHeight,
		) <= 1,
		'action track returns to its minimal measured height after a width round trip',
	);

	await page.locator('#zoom-control').check();
	await settle();
	await assertMobileTextClamps('two-column Grid 320 at 200% text');
	await assertGridOverlaySeparation('two-column Grid 320 at 200% text');
	assert.equal(
		await headphonesActions.getByRole('button', { name: 'Rezervovat' }).isVisible(),
		false,
		'when Reserve plus More cannot fit, Reserve also moves into More',
	);
	await headphonesActions.locator('.more-button').focus();
	await page.keyboard.press('ArrowDown');
	const overflowedReserve = page.getByRole('menuitem', { name: 'Rezervovat', exact: true });
	await overflowedReserve.focus();
	assert.ok(
		await overflowedReserve.evaluate((element) => element === document.activeElement),
		'overflowed primary command is keyboard-reachable in More',
	);
	assert.equal(
		await page.getByRole('menuitem', { name: 'Přijato', exact: true }).count(),
		1,
		'overflow menu contains no duplicate Received command',
	);
	await page.keyboard.press('Escape');
	await select('#lifecycle-control', 'archive');
	await headphonesActions.locator('.more-button').click();
	assert.ok(
		await page.getByRole('menuitem', { name: 'Jen pro čtení', exact: true }).isDisabled(),
		'overflow preserves a disabled command state',
	);
	await page.keyboard.press('Escape');
	await select('#lifecycle-control', 'shared');
	await page.locator('#zoom-control').uncheck();
	await settle();
	await select('#mode-control', 'desktop-list');

	const desktopHeights = new Map();
	for (const width of ['640', '900', '1180', '640', '900', '1180']) {
		await page.setViewportSize({ width: Math.max(700, Number(width) + 40), height: 1000 });
		await select('#width-control', width);
		const cards = page.locator('.gift-card');
		const heights = await cards.evaluateAll((nodes) =>
			nodes.map((node) => node.getBoundingClientRect().height),
		);
		assert.ok(
			Math.max(...heights) - Math.min(...heights) <= 1,
			`desktop rows align at ${width}`,
		);
		const desktopGeometry = await cards.evaluateAll((nodes) =>
			nodes.map((node) => {
				const image = node.querySelector('.image-area').getBoundingClientRect();
				const card = node.getBoundingClientRect();
				const title = node.querySelector('.gift-title');
				const description = node.querySelector('.description-row');
				return {
					imageWidth: image.width,
					imageHeight: image.height,
					cardHeight: card.height,
					titleHeight: [title.clientHeight, title.scrollHeight],
					descriptionHeight: [description.clientHeight, description.scrollHeight],
				};
			}),
		);
		assert.ok(
			desktopGeometry.every(
				(geometry) =>
					Math.abs(geometry.imageWidth - geometry.imageHeight) <= 1 &&
					Math.abs(geometry.imageHeight - geometry.cardHeight) <= 1 &&
					geometry.titleHeight[1] <= geometry.titleHeight[0] + 1 &&
					geometry.descriptionHeight[1] <= geometry.descriptionHeight[0] + 1,
			),
			`desktop List is square/full-height with one-line text at ${width}: ${JSON.stringify(desktopGeometry)}`,
		);
		assert.ok(
			await cards.evaluateAll((nodes) =>
				nodes.every((node) => {
					const main = node.querySelector('.card-main').getBoundingClientRect();
					const title = node.querySelector('.gift-title').getBoundingClientRect();
					const links = node.querySelector('.link-track').getBoundingClientRect();
					const price = node.querySelector('.price').getBoundingClientRect();
					const actions = node.querySelector('.action-group').getBoundingClientRect();
					return (
						Math.abs(title.left - links.left) < 1 &&
						Math.abs(title.left - price.left) < 1 &&
						actions.right <= main.right + 1 &&
						!(
							price.left < actions.right - 0.5 &&
							price.right > actions.left + 0.5 &&
							price.top < actions.bottom - 0.5 &&
							price.bottom > actions.top + 0.5
						)
					);
				}),
			),
			`desktop price and actions are contained, disjoint, and inset-aligned at ${width}`,
		);
		await assertNoPaintOverflow(`desktop ${width}`);
		const previousHeight = desktopHeights.get(width);
		if (previousHeight !== undefined) {
			assert.ok(
				Math.abs(previousHeight - heights[0]) <= 1,
				`desktop ${width} returns to its minimal height`,
			);
		}
		desktopHeights.set(width, heights[0]);
	}

	await select('#theme-control', 'dark');
	await select('#palette-control', 'grape');
	assert.ok(
		await page
			.locator('html')
			.evaluate(
				(node) => node.classList.contains('dark') && node.dataset.palette === 'grape',
			),
		'theme and palette controls apply',
	);
	await select('#theme-control', 'light');
	await select('#palette-control', 'sky');

	for (const width of [320, 360, 390, 430]) {
		await page.setViewportSize({ width, height: 1000 });
		await select('#mode-control', 'mobile-list');
		await select('#width-control', String(width));
		await select('#content-control', 'stress');
		await assertMobileListGeometry(`mobile List ${width}`);
		await assertMobileTextClamps(`mobile List ${width}`);
		assert.ok(
			await page.locator('body').evaluate((node) => node.scrollWidth <= innerWidth + 1),
			`mobile List has no horizontal overflow at ${width}`,
		);
		await page.locator('#zoom-control').check();
		await settle();
		await assertMobileListGeometry(`mobile List ${width} at 200% text`);
		await assertMobileTextClamps(`mobile List ${width} at 200% text`);
		await page.locator('#zoom-control').uncheck();
		await settle();
	}

	await page.setViewportSize({ width: 390, height: 1000 });
	await select('#mode-control', 'mobile-list');
	await select('#width-control', '390');
	await select('#content-control', 'mixed');
	const listImageGeometry = await page.locator('[data-gift-id="backpack"]').evaluate((card) => {
		const cardRectangle = card.getBoundingClientRect();
		const image = card.querySelector('.image-area');
		const imageRectangle = image.getBoundingClientRect();
		const priority = card.querySelector('.priority-badge').getBoundingClientRect();
		return {
			cardWidth: cardRectangle.width,
			imageWidth: imageRectangle.width,
			imageHeight: imageRectangle.height,
			cardHeight: cardRectangle.height,
			priorityBottomGap: imageRectangle.bottom - priority.bottom,
		};
	});
	assert.ok(
		listImageGeometry.imageWidth > listImageGeometry.cardWidth * 0.3 &&
			listImageGeometry.imageWidth <= listImageGeometry.cardWidth * 0.35 + 1 &&
			listImageGeometry.imageWidth <= 153 &&
			Math.abs(listImageGeometry.imageHeight - listImageGeometry.cardHeight) <= 1,
		'mobile List image uses the wider dynamic proposal, remains capped, and fills row height',
	);
	assert.ok(
		Math.abs(listImageGeometry.priorityBottomGap - 7) <= 1,
		'mobile List priority stays at the image bottom with the standard gap',
	);
	const sideCrop = await page
		.locator(
			'[data-gift-id="headphones"] .image-area, [data-gift-id="headphones"] .square-composition',
		)
		.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().toJSON()));
	assert.ok(
		Math.abs(sideCrop[1].width - sideCrop[1].height) < 1 &&
			sideCrop[1].width > sideCrop[0].width,
		'sidecrop clips the same square composition at the portrait frame sides',
	);
	await select('#crop-control', 'fit');
	assert.equal(
		await page
			.locator('[data-gift-id="headphones"] img')
			.evaluate((node) => getComputedStyle(node).objectFit),
		'contain',
		'fit keeps the complete composition',
	);
	await select('#crop-control', 'sidecrop');

	for (const width of [320, 360, 390, 430]) {
		await page.setViewportSize({ width, height: 1000 });
		await select('#mode-control', 'mobile-grid');
		await select('#width-control', String(width));
		await select('#columns-control', '1');
		await select('#content-control', 'mixed');
		const naturalHeights = await page
			.locator('.gift-card')
			.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
		assert.ok(
			new Set(naturalHeights.map(Math.round)).size > 1,
			`single-column Grid is natural at ${width}`,
		);
		assert.equal(
			await page
				.locator('[data-gift-id="teapot"] .description-row')
				.evaluate((node) => getComputedStyle(node).display),
			'none',
			`single-column missing description collapses independently at ${width}`,
		);
		assert.notEqual(
			await page
				.locator('[data-gift-id="headphones"] .description-row')
				.evaluate((node) => getComputedStyle(node).display),
			'none',
			`single-column populated description remains at ${width}`,
		);
		await assertMobileTextClamps(`single-column Grid ${width}`);
		await assertNoPaintOverflow(`single-column Grid ${width}`);

		await select('#columns-control', '2');
		await assertTwoColumnTracks(`two-column Grid ${width}`);
		await assertMobileTextClamps(`two-column Grid ${width}`);
		await assertGridOverlaySeparation(`two-column Grid ${width}`);
		assert.ok(
			await page.locator('body').evaluate((node) => node.scrollWidth <= innerWidth + 1),
			`two-column Grid has no horizontal overflow at ${width}`,
		);
	}

	await page.setViewportSize({ width: 900, height: 1000 });
	await select('#mode-control', 'desktop-list');
	await select('#width-control', '900');
	await select('#content-control', 'mixed');
	const minimalHeight = await page
		.locator('.gift-card')
		.first()
		.evaluate((node) => node.getBoundingClientRect().height);
	for (const content of ['stress', 'mixed', 'stress', 'mixed'])
		await select('#content-control', content);
	assert.ok(
		Math.abs(
			(await page
				.locator('.gift-card')
				.first()
				.evaluate((node) => node.getBoundingClientRect().height)) - minimalHeight,
		) <= 1,
		'repeated content changes shrink back to the same intrinsic desktop height',
	);

	assert.equal(
		await page.locator('[data-gift-id="backpack"] .link-chip').count(),
		2,
		'the second inline link remains visible',
	);
	assert.equal(
		await page.locator('[data-gift-id="backpack"] .link-overflow').textContent(),
		'+1 další',
	);
	await page.locator('[data-gift-id="backpack"] .more-button').click();
	assert.equal(
		await page.locator('#more-links a').count(),
		3,
		'More exposes every link including the overflow link',
	);
	await page.keyboard.press('Escape');
	await page.locator('[data-gift-id="backpack"]').focus();
	await page.keyboard.press('Enter');
	assert.equal(await page.locator('#detail-links a').count(), 3, 'detail exposes every link');
	await page.keyboard.press('Escape');

	await select('#role-control', 'recipient');
	assert.equal(
		await page
			.locator('.state-overlay, .reservation-identity, .like-button, .like-readonly')
			.count(),
		0,
		'ordinary recipient sees no reservation or Like information',
	);
	await select('#role-control', 'promoted');
	assert.equal(await page.getByRole('button', { name: 'Rezervovat', exact: true }).count(), 0);
	assert.equal(await page.locator('.reservation-identity').count(), 0);
	assert.equal(
		await page.locator('[data-gift-id="teapot"] .state-overlay').textContent(),
		'Rezervováno',
		'promoted recipient never receives an own-reservation state',
	);
	await page.locator('[data-gift-id="teapot"] [data-more]').click();
	assert.equal(
		await page.getByRole('menuitem', { name: /Koupeno|Zrušit moji rezervaci/ }).count(),
		0,
		'promoted recipient has no own reservation actions',
	);
	await page.keyboard.press('Escape');

	await select('#role-control', 'manager');
	assert.ok(await page.getByText('Jana Dvořáková', { exact: true }).count());
	assert.ok(
		await page
			.locator('[data-gift-id="headphones"] .action-group')
			.getByRole('button', { name: 'Rezervovat' })
			.count(),
	);
	assert.ok(
		await page
			.locator('[data-gift-id="headphones"] .action-group')
			.getByRole('button', { name: 'Přijato' })
			.count(),
	);
	await page.locator('[data-gift-id="teapot"] [data-more]').click();
	assert.ok(await page.getByRole('menuitem', { name: 'Zrušit moji rezervaci' }).count());
	assert.ok(await page.getByRole('menuitem', { name: 'Koupeno' }).count());
	await page.keyboard.press('Escape');

	await select('#role-control', 'visitor');
	await page.locator('[data-gift-id="teapot"] [data-more]').click();
	assert.ok(await page.getByRole('menuitem', { name: 'Zrušit moji rezervaci' }).count());
	assert.ok(await page.getByRole('menuitem', { name: 'Koupeno' }).count());
	await page.keyboard.press('Escape');
	await select('#role-control', 'anonymous');
	await page.locator('[data-gift-id="teapot"] [data-more]').click();
	assert.ok(await page.getByRole('menuitem', { name: 'Zrušit moji rezervaci' }).count());
	assert.equal(await page.getByRole('menuitem', { name: 'Koupeno' }).count(), 0);
	await page.keyboard.press('Escape');
	await select('#lifecycle-control', 'draft');
	assert.ok(await page.locator('#empty-state').isVisible(), 'visitor draft is gated');

	await select('#role-control', 'manager');
	await select('#lifecycle-control', 'archive');
	assert.ok(await page.locator('.card-action').first().isDisabled(), 'archive is read-only');
	await select('#lifecycle-control', 'shared');

	await page.locator('.gift-card').first().focus();
	await page.keyboard.press('Enter');
	assert.ok(
		await page.locator('#detail-dialog').evaluate((node) => node.open),
		'detail opens by keyboard',
	);
	await page.keyboard.press('Escape');
	const more = page.locator('[data-more]').first();
	await more.focus();
	await page.keyboard.press('ArrowDown');
	assert.ok(await page.locator('#more-popover').isVisible(), 'More opens by keyboard');
	await page.keyboard.press('Escape');
	assert.equal(await more.getAttribute('aria-expanded'), 'false');

	console.log(
		'PASS responsive comparison tracks, overlays, links, privacy, lifecycle, and keyboard checks',
	);
} finally {
	await browser.close();
}
