import '../../../../app.css';
import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import type { LinkedGiftCopy } from '$lib/modules/gifts/types.js';
import * as m from '$lib/paraglide/messages.js';
import GiftLinkedCopiesSection from './GiftLinkedCopiesSection.svelte';

function copy(
	title: string,
	status: LinkedGiftCopy['status'],
	viewerManages = true,
): LinkedGiftCopy {
	return {
		giftId: `gift-${title}`,
		wishlistId: `wishlist-${title}`,
		wishlistShortId: title,
		wishlistTitle: title,
		occasion: 'birthday',
		status,
		editsFrozenFrom: null,
		viewerManages,
	};
}

function unlinkButton(title: string) {
	return page.getByRole('button', { name: m.gift_unlink_copy_label({ title }) });
}

describe('GiftLinkedCopiesSection', () => {
	it('lists each linked list with its occasion, status and the shared-fields note', async () => {
		const screen = await render(GiftLinkedCopiesSection, {
			giftId: 'gift-edited',
			linkedCopies: [copy('Narozeniny', 'active')],
		});
		const section = screen.getByRole('region', { name: m.gift_linked_copies_title() });
		await expect.element(section.getByRole('link', { name: 'Narozeniny' })).toBeVisible();
		await expect
			.element(section.getByLabelText(m.gift_linked_copies_count_label({ count: 1 })))
			.toHaveTextContent('1');
		await expect.element(section.getByText(m.dashboard_status_shared())).toBeVisible();
		await expect.element(section.getByText(m.gift_linked_copies_note())).toBeVisible();
		await screen.unmount();
	});

	it('lets a správce unlink a pair and confirms before unlinking', async () => {
		const screen = await render(GiftLinkedCopiesSection, {
			giftId: 'gift-edited',
			linkedCopies: [copy('Narozeniny', 'active')],
		});
		await unlinkButton('Narozeniny').click();
		const confirm = page.getByRole('dialog', { name: m.gift_unlink_confirm_title() });
		await expect
			.element(confirm)
			.toHaveTextContent(m.gift_unlink_confirm_description({ title: 'Narozeniny' }));
		await confirm.getByRole('button', { name: m.cancel() }).click();
		await expect.element(confirm).not.toBeInTheDocument();
		await screen.unmount();
	});

	it('lets the editor unlink a pair even when the other list is not theirs', async () => {
		const screen = await render(GiftLinkedCopiesSection, {
			giftId: 'gift-edited',
			linkedCopies: [copy('Narozeniny', 'active', false)],
		});
		await expect.element(unlinkButton('Narozeniny')).toBeVisible();
		await screen.unmount();
	});

	it('offers per-list unlinking in a larger group only on non-archived lists the viewer manages', async () => {
		const screen = await render(GiftLinkedCopiesSection, {
			giftId: 'gift-edited',
			linkedCopies: [
				copy('Narozeniny', 'active'),
				copy('Cizí', 'active', false),
				copy('Archiv', 'archived'),
			],
		});
		await expect.element(unlinkButton('Narozeniny')).toBeVisible();
		await expect.element(unlinkButton('Cizí')).not.toBeInTheDocument();
		await expect.element(unlinkButton('Archiv')).not.toBeInTheDocument();
		await screen.unmount();
	});
});
