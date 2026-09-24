import { afterEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { createPixelAssertions } from '../../../../../tests/helpers/pixel-assertions.mjs';
import type { GiftForVisitor } from '$lib/modules/gifts/types.js';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import {
	GiftCardTestHost,
	cleanupCardHosts,
	fixedHosts,
	makeVisitorGift,
	expectRectanglesSeparated,
} from './gift_card.test_fixtures.js';
import { render } from 'vitest-browser-svelte';

const { expectPixelsNear, expectPixelsAtLeast, expectPixelsAtMost } = createPixelAssertions(expect);

afterEach(cleanupCardHosts);

describe('GiftCard unified state presentation (issues #328 and #330)', () => {
	it.each([
		['available', { reservedCount: 0, isFullyReserved: false, myReservationId: null }],
		[
			'partial',
			{ quantity: 3, reservedCount: 1, isFullyReserved: false, myReservationId: null },
		],
		['fully reserved', { reservedCount: 1, isFullyReserved: true, myReservationId: null }],
		['own reserved', { reservedCount: 1, isFullyReserved: true, myReservationId: 'mine' }],
		['received', { received: true, reservedCount: 1, isFullyReserved: true }],
	])(
		'anchors the normal Like to the image clear of footer actions when %s',
		async (_state, overrides) => {
			await page.viewport(390, 720);
			const host = document.createElement('div');
			host.style.width = '179px';
			document.body.appendChild(host);
			fixedHosts.add(host);
			await render(
				GiftCardTestHost,
				{
					gift: makeVisitorGift({ likeCount: 12, ...overrides }),
					role: WISHLIST_ROLES.moderator,
					onreceived: () => {},
					onmore: () => {},
				},
				{ baseElement: host },
			);

			const image = host.querySelector(
				'[data-testid="gift-card-image-frame"]',
			) as HTMLElement;
			const footer = host.querySelector('[data-testid="gift-card-footer"]') as HTMLElement;
			const like = host
				.querySelector('[data-like-heart]')
				?.closest('button') as HTMLButtonElement;
			const likeRect = like.getBoundingClientRect();
			const imageRect = image.getBoundingClientRect();
			const footerRect = footer.getBoundingClientRect();

			expectPixelsAtLeast(likeRect.left, imageRect.left);
			expectPixelsAtMost(likeRect.right, imageRect.right);
			expectPixelsAtLeast(likeRect.top, imageRect.top);
			expectPixelsAtMost(likeRect.bottom, imageRect.bottom);
			expectRectanglesSeparated(likeRect, footerRect);
			for (const action of footer.querySelectorAll<HTMLButtonElement>('button')) {
				if (action !== like) {
					expectRectanglesSeparated(likeRect, action.getBoundingClientRect());
				}
			}
		},
	);

	it('reserves a collision-free image region between the top-right Like and every centered state label', async () => {
		await page.viewport(320, 720);
		const states: Partial<GiftForVisitor>[] = [
			{ quantity: 3, reservedCount: 1, isFullyReserved: false, myReservationId: null },
			{ reservedCount: 1, isFullyReserved: true, myReservationId: null },
			{ reservedCount: 1, isFullyReserved: true, myReservationId: 'mine' },
			{ received: true, reservedCount: 1, isFullyReserved: true, myReservationId: 'mine' },
		];

		for (const [index, overrides] of states.entries()) {
			const host = document.createElement('div');
			host.style.width = '144px';
			document.body.appendChild(host);
			fixedHosts.add(host);
			await render(
				GiftCardTestHost,
				{
					gift: makeVisitorGift({
						id: `gift-state-${index}`,
						likeCount: 12,
						...overrides,
					}),
					role: WISHLIST_ROLES.visitor,
					onmore: () => {},
				},
				{ baseElement: host },
			);

			const likeParts = host.querySelectorAll<HTMLElement>(
				'[data-like-heart], [data-like-count]',
			);
			const pills = host.querySelectorAll<HTMLElement>(
				'[data-testid="gift-state-overlay"] > span',
			);
			for (const pill of pills) {
				const pillRect = pill.getBoundingClientRect();
				for (const likePart of likeParts) {
					const likePartRect = likePart.getBoundingClientRect();
					expectRectanglesSeparated(
						likePartRect,
						pillRect,
						`state ${index}; like ${JSON.stringify(likePartRect.toJSON())}; pill ${JSON.stringify(pillRect.toJSON())}`,
					);
				}
			}
		}
	});

	it('keeps the complete state stack centered on the whole 4:3 image', async () => {
		await page.viewport(320, 720);
		const host = document.createElement('div');
		host.style.width = '144px';
		document.body.appendChild(host);
		fixedHosts.add(host);
		await render(
			GiftCardTestHost,
			{
				gift: makeVisitorGift({
					likeCount: 12,
					received: true,
					reservedCount: 1,
					isFullyReserved: true,
					myReservationId: 'mine',
				}),
				role: WISHLIST_ROLES.visitor,
				onmore: () => {},
			},
			{ baseElement: host },
		);

		const image = host.querySelector<HTMLElement>('[data-testid="gift-card-image-frame"]')!;
		const imageRect = image.getBoundingClientRect();
		const imageStyle = getComputedStyle(image);
		const pillRects = Array.from(
			host.querySelectorAll<HTMLElement>('[data-testid="gift-state-overlay"] > span'),
		).map((pill) => pill.getBoundingClientRect());
		const stackCenter = {
			x:
				(Math.min(...pillRects.map((rect) => rect.left)) +
					Math.max(...pillRects.map((rect) => rect.right))) /
				2,
			y:
				(Math.min(...pillRects.map((rect) => rect.top)) +
					Math.max(...pillRects.map((rect) => rect.bottom))) /
				2,
		};

		// The image's painted border is outside the overlay's centering area.
		expectPixelsNear(
			stackCenter.x,
			imageRect.left +
				(imageRect.width +
					parseFloat(imageStyle.borderLeftWidth) -
					parseFloat(imageStyle.borderRightWidth)) /
					2,
		);
		expectPixelsNear(
			stackCenter.y,
			imageRect.top +
				(imageRect.height +
					parseFloat(imageStyle.borderTopWidth) -
					parseFloat(imageStyle.borderBottomWidth)) /
					2,
		);
	});
});
