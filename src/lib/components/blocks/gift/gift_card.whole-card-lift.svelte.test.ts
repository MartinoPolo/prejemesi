import '../../../../app.css';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
import {
	createPixelAssertions,
	DEFAULT_PIXEL_TOLERANCE,
} from '../../../../../tests/helpers/pixel-assertions.mjs';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import {
	GiftCardTestHost,
	IMAGE_URL,
	cleanupCardHosts,
	makeVisitorGift,
} from './gift_card.test_fixtures.js';

const { expectPixelsNear } = createPixelAssertions(expect);

afterEach(() => {
	cleanupCardHosts();
	document.querySelector('[data-testid="pointer-rest-target"]')?.remove();
});

describe('GiftCard whole-card elevation', () => {
	it('moves the rendered image, title, price, overlays, and working actions as one surface', async () => {
		const onmore = vi.fn();
		const screen = await render(GiftCardTestHost, {
			gift: makeVisitorGift({ imageUrl: IMAGE_URL, price: 1299, currency: 'CZK' }),
			role: WISHLIST_ROLES.visitor,
			onmore,
		});

		const owner = document.querySelector<HTMLElement>('[data-testid="gift-card-surface"]')!;
		const paintedSurface = owner.querySelector<HTMLElement>(
			':scope > [data-slot="elevation-surface"]',
		)!;
		const renderedImage = owner.querySelector<HTMLImageElement>(
			'[data-testid="gift-card-image-frame"] img',
		)!;
		const title = owner.querySelector<HTMLElement>('h3')!;
		const price = owner.querySelector<HTMLElement>('[data-testid="gift-card-price"] > span')!;
		const like = owner
			.querySelector<HTMLButtonElement>('[data-like-heart]')!
			.closest('button')!;
		const actionOwner = owner.querySelector<HTMLButtonElement>(
			'[data-testid="gift-more-actions"]',
		)!;

		expect(owner.classList.contains('elevation-owner-raised')).toBe(true);
		for (const content of [renderedImage, title, price, like, actionOwner]) {
			expect(paintedSurface.contains(content)).toBe(true);
		}
		expect(getComputedStyle(owner).transform).toBe('none');

		const pointerRestTarget = document.createElement('span');
		pointerRestTarget.dataset.testid = 'pointer-rest-target';
		pointerRestTarget.style.cssText =
			'position:fixed;top:10px;left:10px;width:10px;height:10px;z-index:2147483647';
		document.body.append(pointerRestTarget);
		await userEvent.hover(pointerRestTarget);
		await expect
			.poll(
				() =>
					paintedSurface
						.getAnimations()
						.filter((animation) => animation.playState === 'running').length,
			)
			.toBe(0);
		const trackedElements = [renderedImage, title, price, like, actionOwner];
		const ownerBefore = owner.getBoundingClientRect();
		const paintedBefore = paintedSurface.getBoundingClientRect();
		const offsetsBefore = trackedElements.map((element) => {
			const bounds = element.getBoundingClientRect();
			return { x: bounds.x - paintedBefore.x, y: bounds.y - paintedBefore.y };
		});

		await screen.getByTestId('gift-card-surface').hover();
		await expect.poll(() => getComputedStyle(paintedSurface).translate).toBe('0px -2px');
		await expect
			.poll(
				() =>
					paintedSurface
						.getAnimations()
						.filter((animation) => animation.playState === 'running').length,
			)
			.toBe(0);
		const ownerAfter = owner.getBoundingClientRect();
		const paintedAfter = paintedSurface.getBoundingClientRect();

		expectPixelsNear(ownerAfter.top, ownerBefore.top);
		expectPixelsNear(paintedAfter.top, paintedBefore.top - 2);
		for (const [index, element] of trackedElements.entries()) {
			const bounds = element.getBoundingClientRect();
			expectPixelsNear(bounds.x - paintedAfter.x, offsetsBefore[index]!.x);
			expectPixelsNear(bounds.y - paintedAfter.y, offsetsBefore[index]!.y);
		}

		await userEvent.hover(pointerRestTarget);
		await expect
			.poll(() => Math.abs(paintedSurface.getBoundingClientRect().top - paintedBefore.top))
			.toBeLessThanOrEqual(DEFAULT_PIXEL_TOLERANCE);
		await userEvent.click(actionOwner);
		expect(onmore).toHaveBeenCalledOnce();
		actionOwner.focus();
		expect(document.activeElement).toBe(actionOwner);
		actionOwner.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
		);
		expect(onmore).toHaveBeenCalledTimes(2);
	});

	it('keeps nested control hover paint owned by the directly hovered control', async () => {
		const screen = await render(GiftCardTestHost, {
			gift: makeVisitorGift({
				links: [{ url: 'https://example.com/gift', label: 'Obchod' }],
				myReservationId: null,
				reservedCount: 0,
			}),
			role: WISHLIST_ROLES.moderator,
			onreserve: () => {},
			onreceived: () => {},
			onmore: () => {},
		});

		const owner = document.querySelector<HTMLElement>('[data-testid="gift-card-surface"]')!;
		const title = owner.querySelector<HTMLElement>('h3')!;
		const more = owner.querySelector<HTMLButtonElement>('[data-testid="gift-more-actions"]')!;
		const received = owner.querySelector<HTMLButtonElement>(
			'[data-testid="gift-received-toggle"]',
		)!;
		const sourceLink = owner.querySelector<HTMLAnchorElement>('a[target="_blank"]')!;
		const moreSurface = more.querySelector<HTMLElement>(':scope > .elevation-surface')!;
		const receivedSurface = received.querySelector<HTMLElement>(':scope > .elevation-surface')!;
		const sourceSurface = sourceLink.querySelector<HTMLElement>(':scope > .elevation-surface')!;
		const restingPaint = [moreSurface, receivedSurface, sourceSurface].map(
			(element) => getComputedStyle(element).backgroundColor,
		);

		await userEvent.hover(title);
		await expect
			.poll(() =>
				[moreSurface, receivedSurface, sourceSurface].map(
					(element) => getComputedStyle(element).backgroundColor,
				),
			)
			.toEqual(restingPaint);

		await userEvent.hover(more);
		await expect
			.poll(() => getComputedStyle(moreSurface).backgroundColor)
			.not.toBe(restingPaint[0]);
		expect(more.matches(':hover')).toBe(true);
		expect(received.matches(':hover')).toBe(false);
		expect(sourceLink.matches(':hover')).toBe(false);

		await screen.unmount();
	});

	it('does not make a dimmed card a raised owner', async () => {
		await render(GiftCardTestHost, {
			gift: makeVisitorGift({ isFullyReserved: true, reservedCount: 1 }),
			role: WISHLIST_ROLES.visitor,
		});

		const owner = document.querySelector<HTMLElement>('[data-testid="gift-card-surface"]')!;
		expect(owner.classList.contains('elevation-owner')).toBe(false);
		expect(owner.classList.contains('elevation-owner-raised')).toBe(false);
	});
});
