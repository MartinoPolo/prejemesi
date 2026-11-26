import '../../../../app.css';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import type { LinkedGiftCopy } from '$lib/modules/gifts/types.js';
import { WISHLIST_ROLES, type WishlistRole } from '$lib/modules/wishlists/types.js';
import * as m from '$lib/paraglide/messages.js';
import GiftLinkChip from './GiftLinkChip.svelte';
import {
	cleanupCardHosts,
	makeVisitorGift,
	renderCardInGridColumn,
} from './gift_card.test_fixtures.js';
import { renderItem } from './gift_list_item.test_fixtures.js';

const linkedCopies: LinkedGiftCopy[] = [
	{
		giftId: 'copy-1',
		wishlistId: 'wishlist-2',
		wishlistShortId: 'narozeniny',
		wishlistTitle: 'Narozeniny 2027',
		occasion: 'birthday',
		status: 'active',
		editsFrozenFrom: null,
		viewerManages: true,
	},
	{
		giftId: 'copy-2',
		wishlistId: 'wishlist-3',
		wishlistShortId: 'stale',
		wishlistTitle: 'Stálé přání',
		occasion: 'other',
		status: 'draft',
		editsFrozenFrom: null,
		viewerManages: true,
	},
];

const giftName = 'LEGO Technic 42151 Bugatti Bolide';

const chipLabel = m.gift_linked_copies_chip_label({
	titles: 'Narozeniny 2027, Stálé přání',
});

const listHosts = new Set<HTMLElement>();

afterEach(async () => {
	cleanupCardHosts();
	for (const host of listHosts) {
		host.remove();
	}
	listHosts.clear();
	await page.viewport(1280, 760);
});

async function renderListRow(
	gift: ReturnType<typeof makeVisitorGift>,
	role: WishlistRole,
): Promise<HTMLElement> {
	const host = await renderItem(gift, role);
	listHosts.add(host);
	return host;
}

describe('GiftLinkChip on gift presentations', () => {
	it.each([
		['card', renderCardInGridColumn],
		['list row', renderListRow],
	] as const)(
		'shows the linked lists to správci and the recipient on a %s',
		async (_presentation, renderPresentation) => {
			for (const role of [WISHLIST_ROLES.moderator, WISHLIST_ROLES.recipient]) {
				const host = await renderPresentation(makeVisitorGift({ linkedCopies }), role);
				const chip = host.querySelector('[data-slot="gift-link-chip"]');
				expect(chip?.getAttribute('aria-label')).toBe(chipLabel);
				expect(chip?.textContent?.trim()).toBe('2');
			}
		},
	);

	it.each([
		['card', renderCardInGridColumn],
		['list row', renderListRow],
	] as const)(
		'never reveals linked lists to a visitor on a %s',
		async (_presentation, renderPresentation) => {
			const host = await renderPresentation(
				makeVisitorGift({ linkedCopies }),
				WISHLIST_ROLES.visitor,
			);
			expect(host.querySelector('[data-slot="gift-link-chip"]')).toBeNull();
			expect(host.textContent).not.toContain('Narozeniny 2027');
		},
	);

	it('ends the card overlay row beside Like, centred on it, after the categories', async () => {
		const host = await renderCardInGridColumn(
			makeVisitorGift({
				linkedCopies,
				categoryIds: ['category-sport'],
				categories: [
					{
						id: 'category-sport',
						presetKey: null,
						customLabel: 'Sport',
						color: '#0369A1',
						sortOrder: 0,
					},
				],
			}),
			WISHLIST_ROLES.moderator,
		);
		const chip = host.querySelector('[data-slot="gift-link-chip"]')!.getBoundingClientRect();
		const like = host
			.querySelector('[data-like-heart]')!
			.closest('button')!
			.getBoundingClientRect();
		const category = host
			.querySelector('[data-testid="gift-category-badge"]')!
			.getBoundingClientRect();
		const image = host
			.querySelector('[data-testid="gift-card-image-frame"]')!
			.getBoundingClientRect();

		expect(chip.left).toBeGreaterThanOrEqual(like.right);
		expect(chip.left - like.right).toBeLessThanOrEqual(8);
		expect(image.right - chip.right).toBeLessThanOrEqual(16);
		expect(Math.abs(chip.top + chip.height / 2 - (like.top + like.height / 2))).toBeLessThan(1);
		expect(category.right).toBeLessThanOrEqual(like.left);
	});

	it('shows no chip for a gift without linked copies', async () => {
		const host = await renderCardInGridColumn(makeVisitorGift(), WISHLIST_ROLES.moderator);
		expect(host.querySelector('[data-slot="gift-link-chip"]')).toBeNull();
	});
});

describe('GiftLinkChip', () => {
	it('lists the other lists with their status and opens the editor from the popover', async () => {
		await page.viewport(1280, 760);
		const oneditlinkedcopies = vi.fn();
		const screen = await render(GiftLinkChip, { linkedCopies, giftName, oneditlinkedcopies });
		await screen.getByRole('button', { name: chipLabel }).click();

		const popover = page.getByRole('dialog', { name: m.gift_linked_copies_popover_title() });
		await expect.element(popover).toBeVisible();
		await expect
			.element(popover.getByRole('link', { name: 'Narozeniny 2027' }))
			.toHaveAttribute('href', expect.stringContaining('/w/narozeniny'));
		await expect.element(popover.getByText(m.dashboard_status_shared())).toBeVisible();
		await expect.element(popover.getByText(m.dashboard_status_draft())).toBeVisible();

		await popover.getByRole('button', { name: m.gift_linked_copies_edit() }).click();
		expect(oneditlinkedcopies).toHaveBeenCalledOnce();
		await expect.element(popover).not.toBeInTheDocument();
		await screen.unmount();
	});

	it('offers no edit action when the viewer cannot edit the gift', async () => {
		await page.viewport(1280, 760);
		const screen = await render(GiftLinkChip, { linkedCopies, giftName });
		await screen.getByRole('button', { name: chipLabel }).click();
		const popover = page.getByRole('dialog', { name: m.gift_linked_copies_popover_title() });
		await expect.element(popover).toBeVisible();
		await expect
			.element(popover.getByRole('button', { name: m.gift_linked_copies_edit() }))
			.not.toBeInTheDocument();
		await screen.unmount();
	});

	it('opens the lists in a bottom sheet on a narrow screen', async () => {
		await page.viewport(390, 760);
		const screen = await render(GiftLinkChip, {
			linkedCopies,
			giftName,
			oneditlinkedcopies: vi.fn(),
		});
		await screen.getByRole('button', { name: chipLabel }).click();
		const sheet = page.getByRole('dialog', { name: m.gift_linked_copies_popover_title() });
		await expect.element(sheet).toBeVisible();
		await expect.element(sheet).toHaveAccessibleDescription(giftName);
		const row = sheet.getByRole('link', { name: 'Stálé přání' });
		await expect.element(row).toBeVisible();
		expect(row.element().getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
		await expect
			.element(sheet.getByRole('button', { name: m.gift_linked_copies_edit() }))
			.toBeVisible();
		await screen.unmount();
	});

	it('stays a static label while selection or reorder owns the press', async () => {
		const screen = await render(GiftLinkChip, { linkedCopies, giftName, interactive: false });
		await expect.element(screen.getByRole('img', { name: chipLabel })).toBeVisible();
		await expect.element(screen.getByRole('button')).not.toBeInTheDocument();
		await screen.unmount();
	});
});
