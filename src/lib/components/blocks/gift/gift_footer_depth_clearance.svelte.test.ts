import '../../../../app.css';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { createPixelAssertions } from '../../../../../tests/helpers/pixel-assertions.mjs';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import { MORE_ACTION_SELECTOR, visibleAction } from './gift_action_geometry.test_fixtures.js';

vi.mock('$env/dynamic/public', () => ({ env: {} }));

const { GiftCardTestHost, makeVisitorGift } = await import('./gift_card.test_fixtures.js');
const { GiftListItemTestHost } = await import('./gift_list_item.test_fixtures.js');
const { expectPixelsNear } = createPixelAssertions(expect);

const hosts = new Set<HTMLElement>();

afterEach(() => {
	delete document.documentElement.dataset.depth;
	for (const host of hosts) {
		host.remove();
	}
	hosts.clear();
});

async function nextLayout(): Promise<void> {
	await new Promise<void>((resolve) =>
		requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
	);
}

function hostOfWidth(width: number): HTMLElement {
	const host = document.createElement('div');
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	hosts.add(host);
	return host;
}

/** Distances from the visible More face to the surface's inner end and bottom edges. */
function moreActionEdgeDistances(surface: HTMLElement) {
	const row = surface.querySelector<HTMLElement>('[data-testid="gift-action-row"]')!;
	const face = visibleAction(row, MORE_ACTION_SELECTOR).querySelector<HTMLElement>(
		':scope > .elevation-surface',
	)!;
	const surfaceRect = surface.getBoundingClientRect();
	const surfaceStyle = getComputedStyle(surface);
	const faceRect = face.getBoundingClientRect();
	return {
		end: surfaceRect.right - Number.parseFloat(surfaceStyle.borderRightWidth) - faceRect.right,
		bottom:
			surfaceRect.bottom -
			Number.parseFloat(surfaceStyle.borderBottomWidth) -
			faceRect.bottom,
	};
}

async function expectDepthAwareCorner(surface: HTMLElement): Promise<void> {
	const shadowOffset = Number.parseFloat(
		getComputedStyle(surface).getPropertyValue('--elevation-ordinary-offset'),
	);
	expect(shadowOffset).toBeGreaterThan(0);
	document.documentElement.dataset.depth = 'soft';
	await nextLayout();
	const soft = moreActionEdgeDistances(surface);
	expectPixelsNear(soft.end, soft.bottom);
	for (const depth of ['ink', 'black', 'soft'] as const) {
		document.documentElement.dataset.depth = depth;
		await nextLayout();
		const depthClearance = depth === 'soft' ? 0 : shadowOffset;
		const distances = moreActionEdgeDistances(surface);
		expectPixelsNear(distances.end, soft.end + depthClearance);
		expectPixelsNear(distances.bottom, soft.bottom + depthClearance);
	}
}

describe('gift footer depth clearance', () => {
	it.each([
		{ viewport: 1280, width: 360 },
		{ viewport: 390, width: 296 },
	])(
		'keeps the Card More action equidistant from the bottom and end edges at $viewport px',
		async ({ viewport, width }) => {
			await page.viewport(viewport, 900);
			const host = hostOfWidth(width);
			await render(
				GiftCardTestHost,
				{
					gift: makeVisitorGift(),
					role: WISHLIST_ROLES.moderator,
					onreserve: () => {},
					onmore: () => {},
					persistentMore: true,
				},
				{ baseElement: host },
			);
			await nextLayout();
			await expectDepthAwareCorner(
				host.querySelector<HTMLElement>('.gift-card-painted-surface')!,
			);
		},
	);

	it.each([
		{ viewport: 1280, width: 720 },
		{ viewport: 390, width: 360 },
	])(
		'keeps the List More action equidistant from the bottom and end edges at $viewport px',
		async ({ viewport, width }) => {
			await page.viewport(viewport, 900);
			const host = hostOfWidth(width);
			await render(
				GiftListItemTestHost,
				{
					gift: makeVisitorGift(),
					role: WISHLIST_ROLES.moderator,
					isArchived: false,
					onreserve: () => {},
					onmore: () => {},
					persistentMore: true,
				},
				{ baseElement: host },
			);
			await nextLayout();
			await expectDepthAwareCorner(
				host.querySelector<HTMLElement>('[data-testid="gift-list-item"]')!,
			);
		},
	);
});
