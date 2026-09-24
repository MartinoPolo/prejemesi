import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import { overwriteGetLocale } from '$lib/paraglide/runtime.js';
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

	it.each([
		{
			locale: 'cs' as const,
			received: false,
			visible: 'Přijato',
			accessible: 'Označit jako přijatý',
		},
		{
			locale: 'cs' as const,
			received: true,
			visible: 'Nepřijato',
			accessible: 'Označit jako nepřijatý',
		},
		{
			locale: 'en' as const,
			received: false,
			visible: 'Received',
			accessible: 'Mark as received',
		},
		{
			locale: 'en' as const,
			received: true,
			visible: 'Not received',
			accessible: 'Mark as not received',
		},
	])(
		'uses the compact $locale $visible label with the full accessible name',
		async ({ locale, received, visible, accessible }) => {
			overwriteGetLocale(() => locale);
			try {
				const screen = await render(GiftReceivedToggle, {
					giftId: 'gift-compact',
					received,
					role: WISHLIST_ROLES.recipient,
					compactLabel: true,
					onreceived: vi.fn(),
				});
				await expect
					.element(screen.getByRole('button', { name: accessible }))
					.toBeVisible();
				await expect.element(screen.getByText(visible, { exact: true })).toBeVisible();
			} finally {
				overwriteGetLocale(() => 'cs');
			}
		},
	);

	it.each([
		{
			received: false,
			accessible: m.gift_mark_received(),
			intentClass: '.bg-foreground',
			iconClass: '.lucide-check',
		},
		{
			received: true,
			accessible: m.gift_mark_unreceived(),
			intentClass: '.border-status-danger',
			iconClass: '.lucide-undo-2',
		},
	])(
		'uses the shared state-specific intent and action icon when received is $received',
		async ({ received, accessible, intentClass, iconClass }) => {
			const screen = await render(GiftReceivedToggle, {
				giftId: 'gift-intent',
				received,
				role: WISHLIST_ROLES.moderator,
				onreceived: vi.fn(),
			});

			const action = screen.getByRole('button', { name: accessible }).element();
			expect(action.querySelector(intentClass)).toBeTruthy();
			expect(action.querySelector(`${iconClass}[aria-hidden="true"]`)).toBeTruthy();
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

	it('honors external pending state until the route-owned mutation settles', async () => {
		const onreceived = vi.fn();
		const screen = await render(GiftReceivedToggle, {
			giftId: 'gift-1',
			received: true,
			role: WISHLIST_ROLES.recipient,
			pending: true,
			onreceived,
		});
		const action = page.getByRole('button', { name: m.gift_mark_unreceived() });

		await expect.element(action).toBeDisabled();
		await expect.element(action).toHaveAttribute('data-pending', 'true');
		await action.click({ force: true });
		expect(onreceived).not.toHaveBeenCalled();

		await screen.rerender({ pending: false });
		await expect.element(action).toBeEnabled();
		await action.click();
		expect(onreceived).toHaveBeenCalledWith('gift-1', false);
	});

	it('keeps a local disabled acknowledgement while the received mutation is pending', async () => {
		let settle!: () => void;
		const onreceived = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					settle = resolve;
				}),
		);
		await render(GiftReceivedToggle, {
			giftId: 'gift-1',
			received: false,
			role: WISHLIST_ROLES.recipient,
			onreceived,
		});
		const action = page.getByRole('button', { name: m.gift_mark_received() });

		await action.click();

		await expect.element(action).toBeDisabled();
		expect(onreceived).toHaveBeenCalledOnce();
		settle();
		await expect.element(action).toBeEnabled();
	});

	it('restores focus after a failed update reenables its still-connected action', async () => {
		let rejectMutation!: (reason: Error) => void;
		const mutation = new Promise<void>((_resolve, reject) => {
			rejectMutation = reject;
		});
		const onreceived = vi.fn(async () => {
			try {
				await mutation;
			} catch {
				// Simulate route-side recovery without helping the component restore focus.
			}
		});
		await render(GiftReceivedToggle, {
			giftId: 'gift-1',
			received: false,
			role: WISHLIST_ROLES.recipient,
			onreceived,
		});
		const action = page.getByRole('button', { name: m.gift_mark_received() });

		await action.click();
		await expect.element(action).toBeDisabled();
		action.element().blur();
		expect(document.activeElement).toBe(document.body);
		rejectMutation(new Error('mutation failed'));

		await expect.element(action).toBeEnabled();
		await expect.element(action).toHaveFocus();
	});

	it('does not restore focus when the user moves to another control while pending', async () => {
		let settle!: () => void;
		const onreceived = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					settle = resolve;
				}),
		);
		await render(GiftReceivedToggle, {
			giftId: 'gift-1',
			received: false,
			role: WISHLIST_ROLES.recipient,
			onreceived,
		});
		const action = page.getByRole('button', { name: m.gift_mark_received() });
		const nextControl = document.createElement('button');
		document.body.append(nextControl);

		await action.click();
		await expect.element(action).toBeDisabled();
		nextControl.focus();
		settle();

		await expect.element(action).toBeEnabled();
		expect(document.activeElement).toBe(nextControl);
	});

	it('restores focus to the matching action after relocation disconnects its source', async () => {
		let settle!: () => void;
		const onreceived = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					settle = resolve;
				}),
		);
		await render(GiftReceivedToggle, {
			giftId: 'gift-1',
			received: false,
			role: WISHLIST_ROLES.recipient,
			onreceived,
		});
		const source = document.querySelector<HTMLButtonElement>(
			'[data-gift-received-action="gift-1"]',
		)!;

		await page.getByRole('button', { name: m.gift_mark_received() }).click();
		await vi.waitFor(() => expect(source.disabled).toBe(true));
		const sourceFocus = vi.spyOn(source, 'focus');
		source.remove();
		const destination = document.createElement('button');
		destination.dataset.giftReceivedAction = 'gift-1';
		document.body.append(destination);
		settle();

		await vi.waitFor(() => expect(source.disabled).toBe(false));
		expect(sourceFocus).not.toHaveBeenCalled();
		expect(document.activeElement).toBe(destination);
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
