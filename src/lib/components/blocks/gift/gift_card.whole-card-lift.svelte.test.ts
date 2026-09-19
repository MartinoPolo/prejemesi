import '../../../../app.css';
import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import { GiftCardTestHost, cleanupCardHosts, makeVisitorGift } from './gift_card.test_fixtures.js';

afterEach(cleanupCardHosts);

describe('GiftCard whole-card elevation', () => {
	it('moves one painted surface containing the image, content, overlays, and actions', async () => {
		const screen = await render(GiftCardTestHost, {
			gift: makeVisitorGift(),
			role: WISHLIST_ROLES.recipient,
			onreceived: () => {},
			onmore: () => {},
		});

		const owner = document.querySelector<HTMLElement>('[data-testid="gift-card-surface"]')!;
		const paintedSurface = owner.querySelector<HTMLElement>(
			':scope > [data-slot="elevation-surface"]',
		)!;
		const image = owner.querySelector<HTMLElement>('[data-testid="gift-card-image-frame"]')!;
		const title = owner.querySelector<HTMLElement>('[data-gift-card-track="title"]')!;
		const actions = owner.querySelector<HTMLElement>('[data-testid="gift-card-footer"]')!;
		const actionOwner = actions.querySelector<HTMLElement>('[data-slot="button"]')!;

		expect(owner.classList.contains('elevation-owner-raised')).toBe(true);
		expect(paintedSurface).toBeTruthy();
		expect(paintedSurface.contains(image)).toBe(true);
		expect(paintedSurface.contains(title)).toBe(true);
		expect(paintedSurface.contains(actions)).toBe(true);
		const actionSurface = actionOwner.querySelector<HTMLElement>(
			':scope > [data-slot="elevation-surface"]',
		)!;
		expect(actionSurface).toBeTruthy();
		expect(getComputedStyle(owner).transform).toBe('none');

		const ownerBefore = owner.getBoundingClientRect();
		const paintedBefore = paintedSurface.getBoundingClientRect();
		const actionOwnerBefore = actionOwner.getBoundingClientRect();
		const actionSurfaceBefore = actionSurface.getBoundingClientRect();
		await screen.getByTestId('gift-card-surface').hover();
		await new Promise((resolve) => setTimeout(resolve, 300));
		const ownerAfter = owner.getBoundingClientRect();
		const paintedAfter = paintedSurface.getBoundingClientRect();
		const actionOwnerAfter = actionOwner.getBoundingClientRect();
		const actionSurfaceAfter = actionSurface.getBoundingClientRect();

		expect(ownerAfter.top).toBeCloseTo(ownerBefore.top, 1);
		expect(paintedAfter.top).toBeCloseTo(paintedBefore.top - 2, 1);
		expect(actionOwnerAfter.top - paintedAfter.top).toBeCloseTo(
			actionOwnerBefore.top - paintedBefore.top,
			1,
		);
		expect(actionSurfaceAfter.top - actionOwnerAfter.top).toBeCloseTo(
			actionSurfaceBefore.top - actionOwnerBefore.top,
			1,
		);
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(paintedSurface.getBoundingClientRect().top).toBeCloseTo(paintedAfter.top, 1);
	});
});
