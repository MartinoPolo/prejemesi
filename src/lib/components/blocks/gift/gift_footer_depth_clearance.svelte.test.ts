import '../../../../app.css';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { createPixelAssertions } from '../../../../../tests/helpers/pixel-assertions.mjs';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import * as m from '$lib/paraglide/messages.js';
import {
	MORE_ACTION_SELECTOR,
	visibleAction,
	visibleActions,
} from './gift_action_geometry.test_fixtures.js';

vi.mock('$env/dynamic/public', () => ({ env: {} }));

const { GiftCardTestHost, expectRectanglesSeparated, makeVisitorGift } =
	await import('./gift_card.test_fixtures.js');
const { GiftListItemTestHost } = await import('./gift_list_item.test_fixtures.js');
const { expectPixelsNear } = createPixelAssertions(expect);

const BOUGHT_ACTION_SELECTOR = `[aria-label="${m.gift_mark_bought()}"]`;
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

describe('live depth changes re-measure gift layouts', () => {
	const depthCycle = ['soft', 'ink', 'black', 'soft'] as const;

	/** Width the visible actions need: their widths plus the current gap between neighbours. */
	function requiredActionWidth(row: HTMLElement): number {
		const actions = visibleActions(row);
		const gap = Number.parseFloat(getComputedStyle(row).columnGap);
		return (
			actions.reduce((total, action) => total + action.getBoundingClientRect().width, 0) +
			gap * (actions.length - 1)
		);
	}

	it('moves Bought into More when the Black gap no longer fits and restores it at Soft', async () => {
		await page.viewport(1280, 900);
		document.documentElement.dataset.depth = 'soft';
		const host = hostOfWidth(560);
		await render(
			GiftCardTestHost,
			{ gift: makeVisitorGift(), role: WISHLIST_ROLES.moderator, onmore: () => {} },
			{ baseElement: host },
		);
		await nextLayout();
		const row = host.querySelector<HTMLElement>('[data-testid="gift-action-row"]')!;
		expect(row.dataset.overflowActions).toBe('');
		visibleAction(row, BOUGHT_ACTION_SELECTOR);

		// Leave the Soft row a sliver of slack that the larger Black gaps cannot fit into.
		const softSlack = row.clientWidth - requiredActionWidth(row);
		host.style.width = `${560 - softSlack + 2}px`;
		await nextLayout();
		expect(row.dataset.overflowActions).toBe('');

		document.documentElement.dataset.depth = 'black';
		await nextLayout();
		await expect.poll(() => row.dataset.overflowActions).toBe('purchased');
		expect(visibleActions(row).some((action) => action.matches(BOUGHT_ACTION_SELECTOR))).toBe(
			false,
		);

		document.documentElement.dataset.depth = 'soft';
		await nextLayout();
		await expect.poll(() => row.dataset.overflowActions).toBe('');
		visibleAction(row, BOUGHT_ACTION_SELECTOR);
	});

	it('keeps List state badges and their shadow clear of category and priority at every depth', async () => {
		await page.viewport(344, 800);
		const host = hostOfWidth(320);
		await render(
			GiftListItemTestHost,
			{
				gift: makeVisitorGift({
					categoryId: 'category-sport',
					category: {
						id: 'category-sport',
						presetKey: null,
						customLabel: 'Sportovní vybavení',
						color: '#0369A1',
						sortOrder: 0,
					},
					priorityLabel: 'Vysoka',
					isFullyReserved: true,
					reservedCount: 1,
					reserverNames: ['Alexandra Nováková'],
					myReservationId: null,
				}),
				role: WISHLIST_ROLES.moderator,
				isArchived: false,
			},
			{ baseElement: host },
		);
		const item = host.querySelector<HTMLElement>('[data-testid="gift-list-item"]')!;
		const category = host.querySelector<HTMLElement>('[data-testid="gift-category-badge"]')!;
		const priority = host.querySelector<HTMLElement>('[data-testid="gift-priority-badge"]')!;
		const overlayItems = host.querySelectorAll<HTMLElement>(
			'[data-testid="gift-state-overlay"] > span',
		);
		expect(overlayItems.length).toBeGreaterThan(0);

		for (const depth of depthCycle) {
			document.documentElement.dataset.depth = depth;
			await nextLayout();
			await nextLayout();
			const shadowReach = Number.parseFloat(
				getComputedStyle(item).getPropertyValue('--depth-clearance'),
			);
			for (const overlayItem of overlayItems) {
				const badge = overlayItem.getBoundingClientRect();
				const badgeWithShadow = new DOMRect(
					badge.left,
					badge.top,
					badge.width + shadowReach,
					badge.height + shadowReach,
				);
				expectRectanglesSeparated(
					category.getBoundingClientRect(),
					badgeWithShadow,
					`category at ${depth}`,
				);
				expectRectanglesSeparated(
					priority.getBoundingClientRect(),
					badgeWithShadow,
					`priority at ${depth}`,
				);
			}
		}
	});
});
