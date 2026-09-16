import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import type { GiftForVisitor } from '$lib/modules/gifts/types.js';
import type { ReservationForModerator } from '$lib/modules/reservations/types.js';

vi.mock('$env/dynamic/public', () => ({ env: {} }));

const { default: GiftDetailActionBarTestHost } =
	await import('./GiftDetailActionBarTestHost.svelte');

const gift: GiftForVisitor = {
	id: 'gift-detail-action-bar',
	wishlistId: 'wishlist-1',
	name: 'Velmi dlouhý název dárku pro ověření popisků akcí',
	description: null,
	descriptionAppends: [],
	editedAfterShareAt: null,
	links: [],
	price: null,
	priceMax: null,
	currency: null,
	imageUrl: null,
	imageKey: null,
	imageMeta: null,
	quantity: 2,
	sortOrder: 0,
	received: false,
	createdAt: new Date('2026-01-01T00:00:00Z'),
	priorityLevelId: null,
	priorityLabel: null,
	prioritySortOrder: null,
	likeCount: 12,
	reservedCount: 1,
	isFullyReserved: false,
	reserverNames: [],
	myReservationId: null,
	myReservationPurchasedAt: null,
};

const reservation: ReservationForModerator = {
	id: 'reservation-1',
	giftId: gift.id,
	quantity: 1,
	displayName: 'Petr Svoboda',
	releasable: true,
	createdAt: new Date('2026-01-02T00:00:00Z'),
};

function actionElements() {
	return Array.from(document.querySelectorAll<HTMLButtonElement>('button')).filter(
		(button) => button.getBoundingClientRect().height > 0,
	);
}

function textRectangle(element: HTMLElement, text: string) {
	const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
	let node = walker.nextNode();
	while (node !== null && node.textContent?.trim() !== text) {
		node = walker.nextNode();
	}
	if (node === null) {
		throw new Error(`Text not found: ${text}`);
	}

	const range = document.createRange();
	range.selectNodeContents(node);
	return range.getBoundingClientRect();
}

describe('GiftDetailActionBar responsive action geometry', () => {
	it('keeps role-appropriate actions equal-height with an eight-pixel adjacent action gap', async () => {
		for (const role of ['visitor', 'admin'] as const) {
			const screen = await render(GiftDetailActionBarTestHost, {
				gift,
				role,
				reservations: role === 'admin' ? [reservation] : [],
			});

			const like = screen.getByRole('button', {
				name: m.gift_like_add_aria({ name: gift.name }),
			});
			const reserve = screen.getByRole('button', {
				name: m.reserve_button_reserve_aria({ name: gift.name }),
			});
			const release = screen.getByRole('button', {
				name: m.reserve_release_button_aria({ name: gift.name }),
			});

			await expect.element(like).toBeVisible();
			await expect.element(reserve).toBeVisible();
			if (role === 'admin') {
				await expect.element(release).toBeVisible();
			} else {
				expect(
					document.querySelector('[data-testid="release-reservation-button"]'),
				).toBeNull();
			}

			for (const [viewportWidth, expectedHeight] of [
				[390, 40],
				[800, 32],
			] as const) {
				await page.viewport(viewportWidth, 720);
				for (const action of actionElements()) {
					expect(action.getBoundingClientRect().height).toBe(expectedHeight);
				}

				if (role === 'admin') {
					const reserveRectangle = reserve.element().getBoundingClientRect();
					const releaseElement = release.element() as HTMLButtonElement;
					const releaseRectangle = releaseElement.getBoundingClientRect();
					const releaseLabelRectangle = textRectangle(
						releaseElement,
						m.reserve_release_button(),
					);

					expect(releaseRectangle.left - reserveRectangle.right).toBeCloseTo(8, 0);
					expect(releaseLabelRectangle.left).toBeGreaterThanOrEqual(
						releaseRectangle.left,
					);
					expect(releaseLabelRectangle.right).toBeLessThanOrEqual(releaseRectangle.right);
					expect(releaseLabelRectangle.height).toBeLessThan(releaseRectangle.height);
				}
			}

			await screen.unmount();
		}
	});
});
