import '../../../../app.css';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { GIFT_LINK_GROUP_KIND } from '$lib/modules/gifts/gift_link_group_kind.js';
import type { SharedGiftMember } from '$lib/modules/gifts/types.js';
import * as m from '$lib/paraglide/messages.js';
import { makeGift } from '$lib/modules/gifts/gift_ordering.test_fixtures.js';
import { MAX_SHARE_WISHLISTS } from '$lib/modules/gifts/shared_gift.js';

const mocks = vi.hoisted(() => {
	const resolvedCommand = () => ({ updates: vi.fn().mockResolvedValue(undefined) });
	return {
		getGiftShareDestinations: vi.fn(),
		shareGifts: vi.fn(resolvedCommand),
		deleteGift: vi.fn(resolvedCommand),
	};
});

// The avatar's image frame transitively reads `$env/dynamic/public`.
vi.mock('$env/dynamic/public', () => ({ env: {} }));
vi.mock('$lib/modules/gifts/gifts.remote.js', () => ({
	getGiftShareDestinations: mocks.getGiftShareDestinations,
	shareGifts: mocks.shareGifts,
	deleteGift: mocks.deleteGift,
	getGiftsByWishlistShortId: vi.fn(),
}));

const { default: GiftSharedField } = await import('./GiftSharedField.svelte');
const { default: GiftBulkShareDialog } =
	await import('$lib/components/blocks/wishlist/GiftBulkShareDialog.svelte');

const sibling = {
	id: 'wishlist-anicka',
	shortId: 'anicka',
	title: 'Aniččiny Vánoce',
	status: 'active',
	kind: 'occasion',
	recipientDisplayName: 'Anička',
	recipientImage: null,
};

const managedMember: SharedGiftMember = {
	recipientDisplayName: 'Petr',
	recipientImage: null,
	giftId: 'gift-petr',
	wishlistId: 'wishlist-petr',
	wishlistShortId: 'petr',
	wishlistTitle: 'Petrovy Vánoce',
};

beforeEach(() => {
	mocks.getGiftShareDestinations.mockResolvedValue([sibling]);
});

afterEach(async () => {
	vi.clearAllMocks();
	await page.viewport(1280, 760);
});

describe('GiftSharedField (issue #737)', () => {
	it('shares the gift with a checked list of another recipient', async () => {
		const gift = makeGift({ id: 'gift-1' });
		const screen = await render(GiftSharedField, { gift });
		await screen.getByRole('checkbox', { name: /Anička/ }).click();

		expect(mocks.shareGifts).toHaveBeenCalledWith({
			giftIds: ['gift-1'],
			wishlistIds: ['wishlist-anicka'],
		});
		await screen.unmount();
	});

	it('asks before removing the gift from another list and deletes only that list’s gift', async () => {
		const gift = makeGift({
			id: 'gift-1',
			linkGroupKind: GIFT_LINK_GROUP_KIND.sharedAcrossRecipients,
			sharedWith: [managedMember],
		});
		const screen = await render(GiftSharedField, { gift });
		const member = screen.getByRole('checkbox', { name: /Petr/ });
		await member.click();

		const confirm = page.getByRole('alertdialog').or(page.getByRole('dialog'));
		await expect
			.element(
				confirm.getByText(m.gift_shared_field_remove_title({ title: 'Petrovy Vánoce' })),
			)
			.toBeVisible();
		// The row stays checked until the removal is confirmed.
		await expect.element(member).toBeChecked();
		expect(mocks.deleteGift).not.toHaveBeenCalled();

		await confirm.getByRole('button', { name: m.gift_shared_field_remove_confirm() }).click();
		expect(mocks.deleteGift).toHaveBeenCalledWith('gift-petr');
		await screen.unmount();
	});

	it('disables sharing for a gift linked with copies of the same recipient', async () => {
		const gift = makeGift({ linkGroupKind: GIFT_LINK_GROUP_KIND.linkedCopies });
		const screen = await render(GiftSharedField, { gift });
		await expect.element(screen.getByRole('checkbox', { name: /Anička/ })).toBeDisabled();
		await expect.element(screen.getByText(m.gift_shared_field_linked_copy())).toBeVisible();
		await screen.unmount();
	});

	it('marks a list the viewer cannot remove the gift from with a lock', async () => {
		const unmanagedMember: SharedGiftMember = {
			...managedMember,
			giftId: null,
			wishlistId: null,
			wishlistShortId: null,
			wishlistTitle: null,
		};
		const gift = makeGift({
			linkGroupKind: GIFT_LINK_GROUP_KIND.sharedAcrossRecipients,
			sharedWith: [unmanagedMember, { ...managedMember, recipientDisplayName: 'Eva' }],
		});
		const screen = await render(GiftSharedField, { gift });
		const lockedRow = screen.getByTestId('gift-share-list-row').filter({ hasText: 'Petr' });
		const removableRow = screen.getByTestId('gift-share-list-row').filter({ hasText: 'Eva' });
		await expect.element(lockedRow.getByTestId('gift-share-row-lock')).toBeVisible();
		await expect
			.element(removableRow.getByTestId('gift-share-row-lock'))
			.not.toBeInTheDocument();
		await screen.unmount();
	});

	it('offers a retry when the lists to share with fail to load', async () => {
		mocks.getGiftShareDestinations.mockRejectedValueOnce(new Error('offline'));
		const screen = await render(GiftSharedField, { gift: makeGift() });
		await screen.getByRole('button', { name: m.dialog_retry() }).click();
		await expect.element(screen.getByRole('checkbox', { name: /Anička/ })).toBeVisible();
		await screen.unmount();
	});

	it('stays hidden when the gift has no other recipient and no list to share with', async () => {
		mocks.getGiftShareDestinations.mockResolvedValue([]);
		const screen = await render(GiftSharedField, { gift: makeGift() });
		await expect.poll(() => mocks.getGiftShareDestinations.mock.calls.length).toBe(1);
		await expect.element(screen.getByTestId('gift-shared-field')).not.toBeInTheDocument();
		await screen.unmount();
	});
});

describe('GiftBulkShareDialog (issue #737)', () => {
	it('shares every selected gift with the chosen lists and names the categories to add', async () => {
		const gifts = [
			makeGift({
				id: 'gift-1',
				quantity: 3,
				categories: [
					{
						id: 'category-1',
						presetKey: null,
						customLabel: 'Stavebnice',
						color: '#7C3AED',
						sortOrder: 0,
					},
				],
			}),
			makeGift({ id: 'gift-2' }),
		];
		const onopenchange = vi.fn();
		const screen = await render(GiftBulkShareDialog, { open: true, gifts, onopenchange });
		const dialog = page.getByRole('dialog', { name: m.gift_bulk_share_title() });
		const confirm = dialog.getByRole('button', { name: m.gift_bulk_share_confirm() });
		await expect.element(confirm).toBeDisabled();

		await dialog.getByRole('checkbox', { name: /Anička/ }).click();
		await expect
			.element(dialog.getByText(m.gift_bulk_share_categories({ names: 'Stavebnice' })))
			.toBeVisible();
		await expect.element(dialog.getByText(m.gift_bulk_share_quantity())).toBeVisible();
		await confirm.click();

		expect(mocks.shareGifts).toHaveBeenCalledWith({
			giftIds: ['gift-1', 'gift-2'],
			wishlistIds: ['wishlist-anicka'],
		});
		await expect.poll(() => onopenchange.mock.calls).toEqual([[false]]);
		await screen.unmount();
	});

	it('stops offering lists once the share limit is chosen', async () => {
		const manyLists = Array.from({ length: MAX_SHARE_WISHLISTS + 1 }, (_, index) => ({
			...sibling,
			id: `wishlist-${index}`,
			title: `Seznam ${index}`,
			recipientDisplayName: `Obdarovaný ${index}`,
		}));
		mocks.getGiftShareDestinations.mockResolvedValue(manyLists);
		const screen = await render(GiftBulkShareDialog, {
			open: true,
			gifts: [makeGift()],
			onopenchange: vi.fn(),
		});
		const dialog = page.getByRole('dialog', { name: m.gift_bulk_share_title() });
		const listCheckbox = (list: (typeof manyLists)[number]) =>
			dialog.getByRole('checkbox', { name: new RegExp(`${list.title}$`) });
		for (const list of manyLists.slice(0, MAX_SHARE_WISHLISTS)) {
			await listCheckbox(list).click();
		}
		const lastList = manyLists.at(-1)!;
		await expect.element(listCheckbox(lastList)).toBeDisabled();
		await listCheckbox(manyLists[0]!).click();
		await expect.element(listCheckbox(lastList)).toBeEnabled();
		await screen.unmount();
	});

	it('offers a retry when the lists fail to load', async () => {
		mocks.getGiftShareDestinations.mockRejectedValueOnce(new Error('offline'));
		const screen = await render(GiftBulkShareDialog, {
			open: true,
			gifts: [makeGift()],
			onopenchange: vi.fn(),
		});
		const dialog = page.getByRole('dialog', { name: m.gift_bulk_share_title() });
		await dialog.getByRole('button', { name: m.dialog_retry() }).click();
		await expect.element(dialog.getByRole('checkbox', { name: /Anička/ })).toBeVisible();
		await screen.unmount();
	});
});
