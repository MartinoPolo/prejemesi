import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';

const { default: GiftReceivedToggle } = await import('./GiftReceivedToggle.svelte');

describe('GiftReceivedToggle', () => {
	it.each([WISHLIST_ROLES.recipient, WISHLIST_ROLES.moderator])(
		'renders the received action for the %s role',
		async (role) => {
			const screen = await render(GiftReceivedToggle, {
				giftId: 'gift-1',
				received: false,
				role,
				onreceived: vi.fn(),
			});

			await expect
				.element(screen.getByRole('button', { name: m.gift_mark_received() }))
				.toBeVisible();
		},
	);

	it('does not render for a visitor', async () => {
		await render(GiftReceivedToggle, {
			giftId: 'gift-1',
			received: false,
			role: WISHLIST_ROLES.visitor,
			onreceived: vi.fn(),
		});

		expect(document.querySelector('[data-testid="gift-received-toggle"]')).toBeNull();
	});

	it('does not render for a manager without an onreceived callback', async () => {
		await render(GiftReceivedToggle, {
			giftId: 'gift-1',
			received: false,
			role: WISHLIST_ROLES.recipient,
		});

		expect(document.querySelector('[data-testid="gift-received-toggle"]')).toBeNull();
	});

	it('does not render on an archived wishlist', async () => {
		await render(GiftReceivedToggle, {
			giftId: 'gift-1',
			received: false,
			role: WISHLIST_ROLES.recipient,
			isArchived: true,
			onreceived: vi.fn(),
		});

		expect(document.querySelector('[data-testid="gift-received-toggle"]')).toBeNull();
	});

	it('stops the surface click and sends the inverse received state', async () => {
		const onreceived = vi.fn();
		const surfaceClick = vi.fn();
		const host = document.createElement('div');
		host.addEventListener('click', surfaceClick);
		document.body.appendChild(host);
		await render(
			GiftReceivedToggle,
			{
				giftId: 'gift-1',
				received: true,
				role: WISHLIST_ROLES.moderator,
				onreceived,
			},
			{ baseElement: host },
		);

		await page.getByRole('button', { name: m.gift_mark_unreceived() }).click();

		expect(onreceived).toHaveBeenCalledWith('gift-1', false);
		expect(surfaceClick).not.toHaveBeenCalled();
	});
});
