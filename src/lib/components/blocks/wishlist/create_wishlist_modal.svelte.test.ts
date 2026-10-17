import '../../../../app.css';
import { cleanup, render } from 'vitest-browser-svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import { RECIPIENT_KIND, WISHLIST_KIND } from '$lib/modules/wishlists/types.js';

const mocks = vi.hoisted(() => ({
	createWishlist: vi.fn(),
	goto: vi.fn(),
}));
vi.mock('$env/dynamic/public', () => ({ env: {} }));
vi.mock('$app/navigation', () => ({ goto: mocks.goto }));
vi.mock('$lib/modules/wishlists/wishlists.remote.js', () => ({
	createWishlist: mocks.createWishlist,
}));

import CreateWishlistModal from './CreateWishlistModal.svelte';

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

function renderModal() {
	mocks.createWishlist.mockResolvedValue({ shortId: 'created1' });
	return render(CreateWishlistModal, { open: true });
}

describe('CreateWishlistModal wishlist kind', () => {
	it('defaults to an occasion wishlist with the event date directly available', async () => {
		const screen = renderModal();
		const kindGroup = screen.getByRole('group', { name: m.wishlist_kind_label() });

		await expect
			.element(kindGroup.getByRole('radio', { name: m.wishlist_kind_occasion() }))
			.toHaveAttribute('aria-checked', 'true');
		await expect.element(screen.getByText(m.wishlist_kind_occasion_help())).toBeVisible();
		await expect.element(screen.getByText(m.wishlist_event_date_label())).toBeVisible();
	});

	it('hides the event date for a permanent wishlist and explains the kind', async () => {
		const screen = renderModal();

		await screen.getByRole('radio', { name: m.wishlist_kind_permanent() }).click();

		await expect.element(screen.getByText(m.wishlist_kind_permanent_help())).toBeVisible();
		await expect
			.element(screen.getByText(m.wishlist_event_date_label()))
			.not.toBeInTheDocument();

		await screen.getByRole('radio', { name: m.wishlist_kind_occasion() }).click();
		await expect.element(screen.getByText(m.wishlist_event_date_label())).toBeVisible();
	});

	it('keeps the selected kind when its option is pressed again', async () => {
		const screen = renderModal();
		const permanent = screen.getByRole('radio', { name: m.wishlist_kind_permanent() });

		await permanent.click();
		await permanent.click();

		await expect.element(permanent).toHaveAttribute('aria-checked', 'true');
		await expect.element(screen.getByText(m.wishlist_kind_permanent_help())).toBeVisible();
	});

	it('creates a permanent wishlist without an event date', async () => {
		const screen = renderModal();

		await screen.getByRole('textbox', { name: m.wishlist_name_label() }).fill('Stálé přání');
		await screen.getByRole('radio', { name: m.wishlist_kind_permanent() }).click();
		await screen.getByRole('button', { name: m.create(), exact: true }).click();

		await vi.waitFor(() => expect(mocks.createWishlist).toHaveBeenCalledOnce());
		const input = mocks.createWishlist.mock.calls[0]![0];
		expect(input).toMatchObject({
			recipientKind: RECIPIENT_KIND.self,
			title: 'Stálé přání',
			kind: WISHLIST_KIND.permanent,
		});
		expect(input).not.toHaveProperty('eventDate');
	});

	it('drops an event date picked before switching to a permanent wishlist', async () => {
		const screen = renderModal();

		await screen.getByRole('textbox', { name: m.wishlist_name_label() }).fill('Stálé přání');
		const eventDateTrigger = screen.getByRole('button', {
			name: m.wishlist_event_date_label(),
		});
		await eventDateTrigger.click();
		const day = await vi.waitFor(() => {
			const element = document.querySelector<HTMLElement>(
				'[data-bits-day]:not([data-outside-month]):not([data-disabled])',
			);
			expect(element).not.toBeNull();
			return element!;
		});
		day.click();
		await expect.element(eventDateTrigger).not.toHaveTextContent(m.date_picker_placeholder());

		await screen.getByRole('radio', { name: m.wishlist_kind_permanent() }).click();
		await screen.getByRole('button', { name: m.create(), exact: true }).click();

		await vi.waitFor(() => expect(mocks.createWishlist).toHaveBeenCalledOnce());
		const input = mocks.createWishlist.mock.calls[0]![0];
		expect(input).toMatchObject({ title: 'Stálé přání', kind: WISHLIST_KIND.permanent });
		expect(input).not.toHaveProperty('eventDate');
	});

	it('creates an occasion wishlist by default', async () => {
		const screen = renderModal();

		await screen.getByRole('textbox', { name: m.wishlist_name_label() }).fill('Narozeniny');
		await screen.getByRole('button', { name: m.create(), exact: true }).click();

		await vi.waitFor(() => expect(mocks.createWishlist).toHaveBeenCalledOnce());
		expect(mocks.createWishlist.mock.calls[0]![0]).toMatchObject({
			title: 'Narozeniny',
			kind: WISHLIST_KIND.occasion,
			eventDate: null,
		});
	});
});
