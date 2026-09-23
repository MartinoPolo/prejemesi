import { afterEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { createPixelAssertions } from '../../../../../tests/helpers/pixel-assertions.mjs';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import * as m from '$lib/paraglide/messages.js';
import {
	IMAGE_URL,
	GiftCardTestHost,
	cleanupCardHosts,
	contrastRatio,
	expectRectanglesSeparated,
	fixedHosts,
	imageMeta,
	makeVisitorGift,
	parseCssRgb,
	renderCardInGridColumn,
	textOutsideOverlay,
} from './gift_card.test_fixtures.js';

const { default: WishlistGiftDisplay } = await import('../wishlist/WishlistGiftDisplay.svelte');

const { expectPixelsNear, expectPixelsAtLeast, expectPixelsAtMost } = createPixelAssertions(expect);

afterEach(cleanupCardHosts);

describe('GiftCard saved composition containment', () => {
	it.each([390, 900])(
		'keeps the full 4:3 composition inside standalone and collection content at %ipx',
		async (width) => {
			await page.viewport(width, 900);
			const gift = makeVisitorGift({ imageUrl: IMAGE_URL, imageMeta: imageMeta('#ffffff') });
			const standalone = await renderCardInGridColumn(gift);
			const collection = document.createElement('div');
			document.body.appendChild(collection);
			fixedHosts.add(collection);
			await render(
				WishlistGiftDisplay,
				{
					sections: [
						{
							kind: 'available',
							key: 'available',
							label: null,
							gifts: [gift, { ...gift, id: 'peer' }],
						},
					],
					role: WISHLIST_ROLES.recipient,
					isArchived: false,
					hideReservationState: false,
					viewMode: 'card',
					isEmpty: false,
					isFilteredEmpty: false,
					reorderMode: false,
					onedit: () => {},
					onreserve: () => {},
					onunreserve: () => {},
					onreceived: () => {},
					onaddgift: () => {},
					onclearfilters: () => {},
					onreorderpreview: () => {},
					onreordercommit: () => {},
					onreordercancel: () => {},
				},
				{ baseElement: collection },
			);
			await expect
				.poll(() =>
					collection
						.querySelector<HTMLElement>('[data-testid="gift-card-surface"]')
						?.style.getPropertyValue('--gift-card-image-track-height'),
				)
				.toBeTruthy();

			for (const host of [standalone, collection]) {
				for (const frame of host.querySelectorAll<HTMLElement>(
					'[data-testid="gift-card-image-frame"]',
				)) {
					const composition = frame.querySelector<HTMLElement>(
						'[data-testid="gift-card-crop-composition"]',
					)!;
					const frameRect = frame.getBoundingClientRect();
					const compositionRect = composition.getBoundingClientRect();
					const style = getComputedStyle(frame);
					const contentTop = frameRect.top + Number.parseFloat(style.borderTopWidth);
					const separator = frame.querySelector<HTMLElement>(
						'[data-testid="gift-card-image-separator"]',
					)!;
					const separatorTop = separator.getBoundingClientRect().top;
					const contentBottom = separatorTop + 1;
					const contentLeft = frameRect.left + Number.parseFloat(style.borderLeftWidth);
					const contentRight =
						frameRect.right - Number.parseFloat(style.borderRightWidth);
					expect(getComputedStyle(composition).transform).toBe('none');
					expect(compositionRect.width / compositionRect.height).toBeCloseTo(4 / 3, 2);
					expect(compositionRect.width - (contentRight - contentLeft)).toBeGreaterThan(0);
					expect(
						compositionRect.width - (contentRight - contentLeft),
					).toBeLessThanOrEqual(3);
					expect(compositionRect.bottom - contentBottom).toBeGreaterThan(0);
					expect(compositionRect.bottom - contentBottom).toBeLessThanOrEqual(2);
					expectPixelsNear(
						compositionRect.top + compositionRect.height / 2,
						(contentTop + contentBottom) / 2,
					);
					expectPixelsAtLeast(compositionRect.top, contentTop - 2);
					expectPixelsAtMost(compositionRect.bottom, contentBottom + 2);
					expectPixelsAtLeast(compositionRect.left, contentLeft - 2);
					expectPixelsAtMost(compositionRect.right, contentRight + 2);
				}
			}
		},
	);
});

describe('GiftCard category badge (issue #265)', () => {
	it.each([
		{
			color: '#000000',
			expectedBackground: 'rgb(0, 0, 0)',
			expectedForeground: 'rgb(255, 255, 255)',
			palette: 'sky',
			dark: false,
		},
		{
			color: '#FFFFFF',
			expectedBackground: 'rgb(255, 255, 255)',
			expectedForeground: 'rgb(0, 0, 0)',
			palette: 'grape',
			dark: true,
		},
		{
			color: '#777777',
			expectedBackground: 'rgb(119, 119, 119)',
			expectedForeground: 'rgb(0, 0, 0)',
			palette: 'honey',
			dark: false,
		},
	])(
		'keeps $color readable in the $palette palette (dark: $dark)',
		async ({ color, expectedBackground, expectedForeground, palette, dark }) => {
			await page.viewport(800, 720);
			const label = 'Velmi dlouhá kategorie sportovního vybavení pro celou rodinu';
			const host = await renderCardInGridColumn(
				makeVisitorGift({
					categoryId: 'category-sport',
					category: {
						id: 'category-sport',
						presetKey: null,
						customLabel: label,
						color,
						sortOrder: 0,
					},
					isFullyReserved: true,
					received: true,
				}),
				WISHLIST_ROLES.moderator,
				{ palette, dark },
			);

			const badge = host.querySelector('[data-testid="gift-category-badge"]') as HTMLElement;
			const imageFrame = host.querySelector(
				'[data-testid="gift-card-image-frame"]',
			) as HTMLElement;
			expect(badge).toBeTruthy();
			expect(imageFrame).toBeTruthy();
			expectPixelsNear(host.getBoundingClientRect().width, 280);
			expect(badge.title).toBe(label);
			const style = getComputedStyle(badge);
			expect(style.backgroundColor).toBe(expectedBackground);
			expect(style.color).toBe(expectedForeground);
			expect(
				contrastRatio(parseCssRgb(style.backgroundColor), parseCssRgb(style.color)),
			).toBeGreaterThanOrEqual(4.5);
			expect(style.webkitLineClamp).toBe('none');
			expectPixelsAtMost(badge.scrollHeight, badge.clientHeight);
			expect(style.rotate).not.toBe('none');
			expect(Number.parseFloat(style.rotate)).toBeLessThan(0);

			const badgeRect = badge.getBoundingClientRect();
			const imageFrameRect = imageFrame.getBoundingClientRect();
			const separator = imageFrame.querySelector<HTMLElement>(
				'[data-testid="gift-card-image-separator"]',
			)!;
			const contentHeight = separator.getBoundingClientRect().top + 1 - imageFrameRect.top;
			expect(imageFrameRect.width / contentHeight).toBeCloseTo(4 / 3, 2);
			const overlayRects = Array.from(
				host.querySelectorAll<HTMLElement>('[data-testid="gift-state-overlay"] > span'),
				(pill) => pill.getBoundingClientRect(),
			);
			expectPixelsAtLeast(badgeRect.left, imageFrameRect.left);
			expectPixelsAtLeast(badgeRect.top, imageFrameRect.top);
			expectPixelsAtMost(badgeRect.right, imageFrameRect.right);
			expectPixelsAtMost(badgeRect.bottom, imageFrameRect.bottom);
			expect(badgeRect.left + badgeRect.width / 2).toBeLessThan(
				imageFrameRect.left + imageFrameRect.width / 2,
			);
			expect(badgeRect.top + badgeRect.height / 2).toBeLessThan(
				imageFrameRect.top + imageFrameRect.height / 2,
			);
			for (const overlayRect of overlayRects) {
				expectRectanglesSeparated(badgeRect, overlayRect);
			}
		},
	);

	it('hides a moderator gift category only in contextual mode while preserving state and body details', async () => {
		await page.viewport(800, 720);
		const categorizedGift = makeVisitorGift({
			received: true,
			quantity: 3,
			reservedCount: 3,
			isFullyReserved: true,
			myReservationId: null,
			reserverNames: ['Babička'],
			categoryId: 'category-sport',
			category: {
				id: 'category-sport',
				presetKey: null,
				customLabel: 'Sport',
				color: '#0369A1',
				sortOrder: 0,
			},
		});
		const normalHost = await renderCardInGridColumn(categorizedGift, WISHLIST_ROLES.moderator);
		const contextualHost = document.createElement('div');
		contextualHost.style.width = '280px';
		document.body.appendChild(contextualHost);
		fixedHosts.add(contextualHost);
		await render(
			GiftCardTestHost,
			{
				gift: categorizedGift,
				role: WISHLIST_ROLES.moderator,
				contextualMode: true,
			},
			{ baseElement: contextualHost },
		);

		expect(normalHost.querySelector('[data-testid="gift-category-badge"]')).toBeTruthy();
		expect(contextualHost.querySelector('[data-testid="gift-category-badge"]')).toBeNull();
		const overlay = contextualHost.querySelector(
			'[data-testid="gift-state-overlay"]',
		) as HTMLElement;
		expect(overlay.querySelector('[data-state-primary]')?.textContent).toBe(
			m.gift_received_badge(),
		);
		expect(textOutsideOverlay(contextualHost)).not.toContain('Babička');
		expect(
			contextualHost.querySelector('[data-testid="gift-state-overlay"]')?.textContent,
		).toContain('Babička');
	});

	it('renders no category badge while keeping the unchanged image frame for an uncategorized gift', async () => {
		const host = await renderCardInGridColumn(makeVisitorGift());
		expect(host.querySelector('[data-testid="gift-category-badge"]')).toBeNull();
		expect(
			host.querySelector(
				'[data-testid="gift-card-crop-composition"] > [data-testid="image-frame"]',
			),
		).toBeTruthy();
	});
});

describe('GiftCard image background fill (issue #252)', () => {
	it('paints the visible outer card frame with explicit black and removes the pattern', async () => {
		const host = await renderCardInGridColumn(
			makeVisitorGift({ imageUrl: IMAGE_URL, imageMeta: imageMeta('#000000') }),
		);

		const cardFrame = host.querySelector(
			'[data-testid="gift-card-image-frame"]',
		) as HTMLElement;
		const imageFrame = cardFrame.querySelector('[data-testid="image-frame"]') as HTMLElement;

		expect(cardFrame).toBeTruthy();
		expect(imageFrame).toBeTruthy();
		expect(getComputedStyle(cardFrame).backgroundColor).toBe('rgb(0, 0, 0)');
		expect(getComputedStyle(imageFrame).backgroundColor).toBe('rgb(0, 0, 0)');
		expect(cardFrame.querySelector('[data-testid="gift-card-image-pattern"]')).toBeNull();
	});

	it.each([null, 'transparent'])('keeps the pattern for default %s fill', async (bgColor) => {
		const host = await renderCardInGridColumn(
			makeVisitorGift({ imageUrl: IMAGE_URL, imageMeta: imageMeta(bgColor) }),
		);

		const cardFrame = host.querySelector(
			'[data-testid="gift-card-image-frame"]',
		) as HTMLElement;
		expect(cardFrame).toBeTruthy();
		expect(cardFrame.querySelector('[data-testid="gift-card-image-pattern"]')).toBeTruthy();
	});

	it('removes only the mobile Fit mat padding while preserving desktop framing', async () => {
		await page.viewport(390, 720);
		const host = await renderCardInGridColumn(
			makeVisitorGift({ imageUrl: IMAGE_URL, imageMeta: imageMeta('#ffffff') }),
		);
		const image = host.querySelector('img') as HTMLImageElement;
		const frame = host.querySelector('[data-testid="image-frame"]') as HTMLElement;
		const outerFrame = host.querySelector(
			'[data-testid="gift-card-image-frame"]',
		) as HTMLElement;
		const cropComposition = host.querySelector(
			'[data-testid="gift-card-crop-composition"]',
		) as HTMLElement;

		const expectStableComposition = () => {
			const outerRect = outerFrame.getBoundingClientRect();
			const cropRect = cropComposition.getBoundingClientRect();
			const frameRect = frame.getBoundingClientRect();
			expect(cropRect.width / cropRect.height).toBeCloseTo(4 / 3, 2);
			expectPixelsNear(frameRect.width, cropRect.width);
			expectPixelsNear(frameRect.height, cropRect.height);
			const separator = outerFrame.querySelector<HTMLElement>(
				'[data-testid="gift-card-image-separator"]',
			)!;
			const visibleContentCenter =
				(outerRect.top + separator.getBoundingClientRect().top) / 2;
			expectPixelsNear(cropRect.top + cropRect.height / 2, visibleContentCenter);
		};

		expect(getComputedStyle(image).padding).toBe('0px');
		expectStableComposition();
		await page.viewport(800, 720);
		expect(getComputedStyle(image).padding).toBe('8px');
		expectStableComposition();
	});
});
