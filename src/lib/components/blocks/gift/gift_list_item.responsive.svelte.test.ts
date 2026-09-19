import '../../../../app.css';
import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import { IMAGE_FIT_MODES, type ImageMetadata } from '$lib/modules/images/index.js';
import * as m from '$lib/paraglide/messages.js';
vi.mock('$env/dynamic/public', () => ({ env: {} }));

import {
	IMAGE_URL,
	imageMeta,
	makeVisitorGift,
	renderItem,
	hasVisibleBoxShadow,
	GiftListItemTestHost,
} from './gift_list_item.test_fixtures.js';

describe('GiftListItem responsive image dimensions (issues #328 and #336)', () => {
	it.each([320, 480, 600])(
		'keeps short rows portrait without unnecessary height at %d px',
		async (width) => {
			await page.viewport(width + 24, 720);
			const host = await renderItem(
				makeVisitorGift({ name: 'Kniha', myReservationId: null, reservedCount: 0 }),
				WISHLIST_ROLES.recipient,
				null,
				width,
			);
			const item = host.querySelector<HTMLElement>('[data-testid="gift-list-item"]')!;
			const image = host.querySelector<HTMLElement>('[data-testid="gift-list-image"]')!;
			const rootFontSize = Number.parseFloat(
				getComputedStyle(document.documentElement).fontSize,
			);
			const itemStyle = getComputedStyle(item);
			const borders =
				Number.parseFloat(itemStyle.borderTopWidth) +
				Number.parseFloat(itemStyle.borderBottomWidth);
			const imageRect = image.getBoundingClientRect();
			expect(imageRect.width).toBeCloseTo(
				Math.min(item.clientWidth * 0.35, 9.5 * rootFontSize),
				0,
			);
			expect(imageRect.height).toBeGreaterThan(imageRect.width);
			expect(item.getBoundingClientRect().height).toBeCloseTo(
				Math.max(9 * rootFontSize, imageRect.width + borders + 1),
				0,
			);
			host.remove();
		},
	);
	it('removes only mobile Fit padding while keeping the square composition full-height', async () => {
		await page.viewport(390, 720);
		const host = await renderItem(
			makeVisitorGift({ imageUrl: IMAGE_URL, imageMeta: imageMeta('#ffffff') }),
			WISHLIST_ROLES.visitor,
		);
		const image = host.querySelector('img') as HTMLImageElement;
		const frame = host.querySelector('[data-testid="image-frame"]') as HTMLElement;
		const imageRegion = host.querySelector('[data-testid="gift-list-image"]') as HTMLElement;

		expect(getComputedStyle(image).padding).toBe('0px');
		expect(frame.getBoundingClientRect().width).toBeCloseTo(
			frame.getBoundingClientRect().height,
			0,
		);
		expect(frame.getBoundingClientRect().width).toBeGreaterThan(imageRegion.clientWidth);
		expect(frame.getBoundingClientRect().height).toBeCloseTo(imageRegion.clientHeight, 0);
		await page.viewport(800, 720);
		expect(getComputedStyle(image).padding).toBe('8px');
		host.remove();
	});

	it('keeps the desktop image square and equal to the full inner row height', async () => {
		await page.viewport(800, 720);
		const host = await renderItem(makeVisitorGift(), WISHLIST_ROLES.visitor);
		const item = host.querySelector('[data-testid="gift-list-item"]') as HTMLElement;
		const image = host.querySelector('[data-testid="gift-list-image"]') as HTMLElement;
		const itemRect = item.getBoundingClientRect();
		const imageRect = image.getBoundingClientRect();
		const itemStyle = getComputedStyle(item);
		const innerHeight =
			itemRect.height -
			Number.parseFloat(itemStyle.borderTopWidth) -
			Number.parseFloat(itemStyle.borderBottomWidth);

		expect(imageRect.width).toBeGreaterThanOrEqual(128);
		expect(imageRect.width).toBeCloseTo(imageRect.height, 0);
		expect(imageRect.height).toBeCloseTo(innerHeight, 0);
		host.remove();
	});

	it('clips the persisted square manual composition through the centered portrait window', async () => {
		await page.viewport(344, 720);
		const manualMeta: ImageMetadata = {
			fitMode: IMAGE_FIT_MODES.coverCrop,
			cropRect: null,
			focal: { x: 50, y: 50 },
			zoom: 1,
			bgColor: '#ffffff',
			targets: {
				thumb: {
					cropRect: { x: 0.13, y: 0.57, w: 0.4, h: 0.4 },
					focal: { x: 23, y: 67 },
					zoom: 1.8,
				},
			},
		};
		const host = await renderItem(
			makeVisitorGift({ imageUrl: IMAGE_URL, imageMeta: manualMeta }),
			WISHLIST_ROLES.visitor,
			null,
			320,
		);
		const viewport = host.querySelector('[data-testid="gift-list-image"]') as HTMLElement;
		const squareFrame = host.querySelector('[data-testid="image-frame"]') as HTMLElement;
		const renderedImage = squareFrame.querySelector('img') as HTMLImageElement;
		const viewportRect = viewport.getBoundingClientRect();
		const frameRect = squareFrame.getBoundingClientRect();

		expect(getComputedStyle(viewport).overflow).toBe('hidden');
		expect(frameRect.width).toBeCloseTo(frameRect.height, 0);
		expect(frameRect.height).toBeCloseTo(viewportRect.height, 0);
		expect(frameRect.width).toBeGreaterThan(viewportRect.width);
		expect(frameRect.left + frameRect.width / 2).toBeCloseTo(
			viewportRect.left + viewport.clientLeft + viewport.clientWidth / 2,
			0,
		);
		expect(getComputedStyle(renderedImage).objectPosition).toBe('23% 67%');
		expect(renderedImage.style.transform).toContain('scale(1.8)');
		host.remove();
	});

	it.each([320, 360])(
		'uses a full-height portrait image beside content at an actual %d px host width',
		async (width) => {
			await page.viewport(width + 24, 720);
			const host = await renderItem(
				makeVisitorGift({ isFullyReserved: true, myReservationId: null }),
				WISHLIST_ROLES.visitor,
				null,
				width,
			);
			const item = host.querySelector('[data-testid="gift-list-item"]') as HTMLElement;
			const image = host.querySelector('[data-testid="gift-list-image"]') as HTMLElement;
			const content = host.querySelector('[data-testid="gift-list-content"]') as HTMLElement;
			const itemRect = item.getBoundingClientRect();
			const imageRect = image.getBoundingClientRect();
			const itemStyle = getComputedStyle(item);
			const innerHeight =
				itemRect.height -
				Number.parseFloat(itemStyle.borderTopWidth) -
				Number.parseFloat(itemStyle.borderBottomWidth);
			const expectedWidth = Math.min(item.clientWidth * 0.35, 152);

			expect(imageRect.width).toBeCloseTo(expectedWidth, 0);
			expect(imageRect.height).toBeCloseTo(innerHeight, 0);
			expect(imageRect.width).toBeLessThan(imageRect.height);
			expect(content.getBoundingClientRect().left).toBeCloseTo(imageRect.right, 0);
			expect(host.querySelectorAll('[data-testid="gift-state-overlay"]')).toHaveLength(1);
			expect(host.querySelector('[data-testid="gift-reserved-sticker"]')).toBeNull();
			host.remove();
		},
	);

	it('keeps manager actions compact in a horizontal mobile list row, outside the image', async () => {
		await page.viewport(390, 720);
		const onreserve = vi.fn();
		const onreceived = vi.fn();
		const onmore = vi.fn();
		const host = document.createElement('div');
		document.body.appendChild(host);
		await render(
			GiftListItemTestHost,
			{
				gift: makeVisitorGift({ myReservationId: null, reservedCount: 0 }),
				role: WISHLIST_ROLES.moderator,
				isArchived: false,
				onreserve,
				onreceived,
				onmore,
			},
			{ baseElement: host },
		);

		const item = host.querySelector('[data-testid="gift-list-item"]') as HTMLElement;
		const image = host.querySelector('[data-testid="gift-list-image"]') as HTMLElement;
		const content = host.querySelector('[data-testid="gift-list-content"]') as HTMLElement;
		const received = host.querySelector('[data-testid="gift-received-toggle"]') as HTMLElement;
		const more = host.querySelector(`[aria-label="${m.gift_more_actions()}"]`) as HTMLElement;
		const reserveButtons = host.querySelectorAll<HTMLElement>('[data-testid="reserve-button"]');
		const reserve = reserveButtons[0]!;
		expect(reserveButtons).toHaveLength(1);
		expect(image.querySelector('[data-testid="reserve-button"]')).toBeNull();
		expect(content.contains(reserve)).toBe(true);
		expect(getComputedStyle(item).display).toBe('grid');
		expect(content.getBoundingClientRect().left).toBeCloseTo(
			image.getBoundingClientRect().right,
			0,
		);
		for (const action of [reserve, received, more]) {
			expect(action.getBoundingClientRect().height).toBeCloseTo(40, 0);
		}
		reserve.click();
		received.click();
		more.click();
		expect(onreserve).toHaveBeenCalledOnce();
		expect(onreceived).toHaveBeenCalledWith('gift-1', true);
		expect(onmore).toHaveBeenCalledOnce();

		const withoutReceivedHost = document.createElement('div');
		document.body.appendChild(withoutReceivedHost);
		await render(
			GiftListItemTestHost,
			{
				gift: makeVisitorGift({ id: 'gift-without-received', myReservationId: null }),
				role: WISHLIST_ROLES.moderator,
				onreserve: () => {},
			},
			{ baseElement: withoutReceivedHost },
		);
		expect(withoutReceivedHost.querySelectorAll('[data-testid="reserve-button"]')).toHaveLength(
			1,
		);
		expect(
			withoutReceivedHost
				.querySelector('[data-testid="gift-list-image"]')
				?.querySelector('[data-testid="reserve-button"]'),
		).toBeNull();
		host.remove();
		withoutReceivedHost.remove();
	});

	it('does not render Like for an archived visitor gift while preserving own cancellation', async () => {
		await page.viewport(390, 720);
		const host = document.createElement('div');
		document.body.appendChild(host);
		await render(
			GiftListItemTestHost,
			{
				gift: makeVisitorGift({ myReservationId: 'reservation-1' }),
				role: WISHLIST_ROLES.visitor,
				isArchived: true,
				onunreserve: () => {},
			},
			{ baseElement: host },
		);

		expect(host.querySelector('[data-like-heart]')).toBeNull();
		expect(host.querySelector('[data-testid="reserve-button"]')).toBeTruthy();
	});

	it('leaves no reservation, Like, or Purchased trace for recipients', async () => {
		await page.viewport(390, 720);
		const host = await renderItem(
			makeVisitorGift({
				isFullyReserved: true,
				myReservationId: 'private-reservation',
				myReservationPurchasedAt: new Date('2026-01-03'),
				reserverNames: ['Soukromá osoba'],
			}),
			WISHLIST_ROLES.recipient,
		);

		expect(host.querySelector('[data-testid="gift-state-overlay"]')).toBeNull();
		expect(host.querySelector('[aria-pressed]')).toBeNull();
		expect(host.textContent).not.toMatch(/rezerv|koupen|Soukromá osoba/i);
	});
});

describe('GiftListItem content hierarchy (issue #377)', () => {
	it('places price on its own left-aligned line below source links', async () => {
		await page.viewport(800, 720);
		const host = await renderItem(
			makeVisitorGift({
				links: [
					{ url: 'https://example.com/first' },
					{ url: 'https://shop.example.org/second' },
				],
				price: 2499,
				currency: 'CZK',
			}),
			WISHLIST_ROLES.visitor,
		);
		const links = host.querySelector('[data-testid="gift-link-list"]') as HTMLElement;
		const price = host.querySelector('[data-testid="gift-list-price"]') as HTMLElement;
		const content = host.querySelector('[data-testid="gift-list-content"]') as HTMLElement;

		expect(price.getBoundingClientRect().top).toBeGreaterThanOrEqual(
			links.getBoundingClientRect().bottom,
		);
		expect(price.getBoundingClientRect().left).toBeCloseTo(
			content.getBoundingClientRect().left +
				Number.parseFloat(getComputedStyle(content).paddingLeft),
			0,
		);
		host.remove();
	});

	it('keeps the right-aligned action lane on one line', async () => {
		await page.viewport(390, 720);
		const host = document.createElement('div');
		host.style.width = '360px';
		document.body.appendChild(host);
		await render(
			GiftListItemTestHost,
			{
				gift: makeVisitorGift({ myReservationId: null, reservedCount: 0 }),
				role: WISHLIST_ROLES.moderator,
				onreserve: () => {},
				onreceived: () => {},
				onmore: () => {},
			},
			{ baseElement: host },
		);
		const actionRow = host.querySelector('[data-testid="gift-action-row"]') as HTMLElement;
		const actionTops = Array.from(
			actionRow.querySelectorAll<HTMLElement>('button'),
			(button) => button.getBoundingClientRect().top,
		);

		expect(getComputedStyle(actionRow).flexWrap).toBe('nowrap');
		expect(Math.max(...actionTops) - Math.min(...actionTops)).toBeLessThanOrEqual(1);
		host.remove();
	});
});

describe('GiftListItem title hierarchy (issue #377)', () => {
	it.each([
		{ viewport: 390, hostWidth: 360, expectedLines: '2' },
		{ viewport: 800, hostWidth: 640, expectedLines: '1' },
	])(
		'clamps descriptions to $expectedLines visible line(s) at an actual $hostWidth px host width',
		async ({ viewport, hostWidth, expectedLines }) => {
			await page.viewport(viewport, 720);
			const host = await renderItem(
				makeVisitorGift({
					description:
						'Dlouhý popis dárku s několika podrobnostmi, který se nesmí rozlévat do dalších řádků.',
				}),
				WISHLIST_ROLES.visitor,
				null,
				hostWidth,
			);
			const description = host.querySelector('.gift-list-description') as HTMLElement;

			expect(getComputedStyle(description).webkitLineClamp).toBe(expectedLines);
			host.remove();
		},
	);

	it('keeps two title lines at an actual narrow mobile container width', async () => {
		await page.viewport(390, 720);
		const host = await renderItem(makeVisitorGift(), WISHLIST_ROLES.visitor, null, 360);
		const title = host.querySelector('.gift-list-title') as HTMLElement;

		expect(getComputedStyle(title).webkitLineClamp).toBe('2');
		host.remove();
	});

	it.each([
		{ viewport: 390, expectedSize: 16, expectedLines: '2' },
		{ viewport: 800, expectedSize: 24, expectedLines: '1' },
	])(
		'clamps an unbroken title at $viewport px',
		async ({ viewport, expectedSize, expectedLines }) => {
			await page.viewport(viewport, 720);
			const host = await renderItem(
				makeVisitorGift({
					name: 'MimořádněDlouhýNerozdělitelnýNázevDárkuKterýMusíZůstatUvnitřŘádku',
				}),
				WISHLIST_ROLES.visitor,
			);
			const title = host.querySelector('.gift-list-title') as HTMLElement;
			const style = getComputedStyle(title);

			expect(Number.parseFloat(style.fontSize)).toBeCloseTo(expectedSize, 0);
			expect(style.webkitLineClamp).toBe(expectedLines);
			expect(style.overflowWrap).toBe('anywhere');
			expect(title.title).toBe(title.textContent?.trim());
			host.remove();
		},
	);
});

describe('GiftListItem approved Like geometry (issue #357)', () => {
	it.each([
		{ viewport: 390, count: 0 },
		{ viewport: 800, count: 7 },
		{ viewport: 1440, count: 123 },
	])(
		'centers count $count and the ghost heart on the first title line at $viewport px',
		async ({ viewport, count }) => {
			await page.viewport(viewport, 720);
			const host = await renderItem(
				makeVisitorGift({
					likeCount: count,
					received: true,
					isFullyReserved: true,
					myReservationId: 'mine',
				}),
				WISHLIST_ROLES.visitor,
			);
			const item = host.querySelector('[data-testid="gift-list-item"]') as HTMLElement;
			const image = host.querySelector('[data-testid="gift-list-image"]') as HTMLElement;
			const content = host.querySelector('[data-testid="gift-list-content"]') as HTMLElement;
			const title = content.querySelector('.gift-list-title') as HTMLElement;
			const like = host.querySelector('[data-like-heart]')?.closest('button') as HTMLElement;
			const heart = like.querySelector('[data-like-heart]') as HTMLElement;
			const countNode = like.querySelector('[data-like-count]') as HTMLElement;
			const imageRect = image.getBoundingClientRect();
			const titleRect = title.getBoundingClientRect();
			const titleLineHeight = Number.parseFloat(getComputedStyle(title).lineHeight);

			expect(item.contains(like)).toBe(true);
			expect(image.contains(like)).toBe(false);
			expect(content.contains(like)).toBe(true);
			expect(content.contains(title)).toBe(true);
			expect(imageRect.width).toBeCloseTo(imageRect.height, 0);
			expect(
				like.getBoundingClientRect().top + like.getBoundingClientRect().height / 2,
			).toBeCloseTo(titleRect.top + titleLineHeight / 2, 1);
			expect(countNode.textContent).toBe(String(count));
			expect(getComputedStyle(countNode).display).not.toBe('none');
			expect(heart.getBoundingClientRect().right).toBeLessThanOrEqual(
				countNode.getBoundingClientRect().left,
			);
			expect(hasVisibleBoxShadow(like.querySelector('.elevation-surface')!)).toBe(false);
			host.remove();
		},
	);
});
