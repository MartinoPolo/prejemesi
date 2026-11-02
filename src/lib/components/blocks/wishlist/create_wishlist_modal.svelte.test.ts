import '../../../../app.css';
import { cleanup, render } from 'vitest-browser-svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import { RECIPIENT_KIND, WISHLIST_OCCASION } from '$lib/modules/wishlists/types.js';
import { wishlistThemeName } from '$lib/theme/wishlist_theme_messages.js';

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

describe('CreateWishlistModal created handler', () => {
	it('hands the created wishlist to the caller instead of navigating to it', async () => {
		mocks.createWishlist.mockResolvedValue({ id: 'wishlist-1', shortId: 'created1' });
		const oncreated = vi.fn();
		const screen = render(CreateWishlistModal, { open: true, oncreated });

		await screen.getByRole('textbox', { name: m.wishlist_name_label() }).fill('Vánoce');
		await screen.getByRole('button', { name: m.create(), exact: true }).click();

		await vi.waitFor(() =>
			expect(oncreated).toHaveBeenCalledWith({ id: 'wishlist-1', shortId: 'created1' }),
		);
		expect(mocks.goto).not.toHaveBeenCalled();
		await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
	});

	it('creates nothing when cancelled', async () => {
		const oncreated = vi.fn();
		const screen = render(CreateWishlistModal, { open: true, oncreated });

		await screen.getByRole('textbox', { name: m.wishlist_name_label() }).fill('Vánoce');
		await screen.getByRole('button', { name: m.cancel(), exact: true }).click();

		await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
		expect(mocks.createWishlist).not.toHaveBeenCalled();
		expect(oncreated).not.toHaveBeenCalled();
	});

	it('keeps the modal open with the error when creation fails', async () => {
		mocks.createWishlist.mockRejectedValue(new Error('Limit reached'));
		const oncreated = vi.fn();
		const screen = render(CreateWishlistModal, { open: true, oncreated });

		await screen.getByRole('textbox', { name: m.wishlist_name_label() }).fill('Vánoce');
		await screen.getByRole('button', { name: m.create(), exact: true }).click();

		await expect.element(screen.getByText('Limit reached')).toBeVisible();
		expect(oncreated).not.toHaveBeenCalled();
	});
});

async function pickFirstAvailableDay(screen: ReturnType<typeof renderModal>) {
	const eventDateTrigger = screen.getByRole('button', { name: m.wishlist_event_date_label() });
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
	return eventDateTrigger;
}

async function submitWithTitle(screen: ReturnType<typeof renderModal>, title: string) {
	await screen.getByRole('textbox', { name: m.wishlist_name_label() }).fill(title);
	await screen.getByRole('button', { name: m.create(), exact: true }).click();
	await vi.waitFor(() => expect(mocks.createWishlist).toHaveBeenCalledOnce());
	return mocks.createWishlist.mock.calls[0]![0];
}

describe('CreateWishlistModal occasion', () => {
	it('offers every occasion and defaults to Jiná with the event date directly available', async () => {
		const screen = renderModal();
		const occasionGroup = screen.getByRole('group', { name: m.wishlist_occasion_label() });

		for (const label of [
			m.wishlist_occasion_christmas(),
			m.wishlist_occasion_birthday(),
			m.wishlist_occasion_name_day(),
			m.wishlist_occasion_wedding(),
			m.wishlist_occasion_baby(),
			m.wishlist_occasion_graduation(),
			m.wishlist_occasion_other(),
			m.wishlist_kind_permanent(),
		]) {
			await expect.element(occasionGroup.getByRole('radio', { name: label })).toBeVisible();
		}
		await expect
			.element(occasionGroup.getByRole('radio', { name: m.wishlist_occasion_other() }))
			.toHaveAttribute('aria-checked', 'true');
		await expect.element(screen.getByText(m.wishlist_kind_occasion_help())).toBeVisible();
		await expect
			.element(screen.getByRole('button', { name: m.wishlist_event_date_label() }))
			.toHaveAccessibleDescription(m.wishlist_event_date_helper());
	});

	it('hides the event date for the Stálý seznam and explains it', async () => {
		const screen = renderModal();

		await screen.getByRole('radio', { name: m.wishlist_kind_permanent() }).click();

		await expect.element(screen.getByText(m.wishlist_kind_permanent_help())).toBeVisible();
		await expect
			.element(screen.getByText(m.wishlist_event_date_label()))
			.not.toBeInTheDocument();

		await screen.getByRole('radio', { name: m.wishlist_occasion_birthday() }).click();
		await expect.element(screen.getByText(m.wishlist_event_date_label())).toBeVisible();
	});

	it('keeps the selected occasion when its option is pressed again', async () => {
		const screen = renderModal();
		const permanent = screen.getByRole('radio', { name: m.wishlist_kind_permanent() });

		await permanent.click();
		await permanent.click();

		await expect.element(permanent).toHaveAttribute('aria-checked', 'true');
		await expect.element(screen.getByText(m.wishlist_kind_permanent_help())).toBeVisible();
	});

	it('creates a Stálý seznam without an event date, dropping a date picked before', async () => {
		const screen = renderModal();

		await pickFirstAvailableDay(screen);
		await screen.getByRole('radio', { name: m.wishlist_kind_permanent() }).click();
		const input = await submitWithTitle(screen, 'Stálé přání');

		expect(input).toMatchObject({
			recipientKind: RECIPIENT_KIND.self,
			title: 'Stálé přání',
			occasion: WISHLIST_OCCASION.permanent,
		});
		expect(input).not.toHaveProperty('eventDate');
		expect(input).not.toHaveProperty('kind');
	});

	it('creates a Jiná wishlist without a date by default', async () => {
		const screen = renderModal();

		const input = await submitWithTitle(screen, 'Dárky');

		expect(input).toMatchObject({
			title: 'Dárky',
			occasion: WISHLIST_OCCASION.other,
			eventDate: null,
		});
	});

	it('sends the chosen occasion', async () => {
		const screen = renderModal();

		await screen.getByRole('radio', { name: m.wishlist_occasion_name_day() }).click();
		const input = await submitWithTitle(screen, 'Svátek');

		expect(input).toMatchObject({ occasion: WISHLIST_OCCASION.nameDay, eventDate: null });
	});
});

describe('CreateWishlistModal Vánoce', () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date('2026-11-02T10:00:00Z'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	const christmasThemeName = () => wishlistThemeName('christmas');
	const themeTrigger = (screen: ReturnType<typeof renderModal>) =>
		screen.getByRole('button', { name: m.wishlist_appearance_theme_heading(), exact: true });

	it('pre-fills the next 24. 12. and suggests the christmas motif', async () => {
		const screen = renderModal();

		await screen.getByRole('radio', { name: m.wishlist_occasion_christmas() }).click();

		await expect
			.element(screen.getByRole('button', { name: m.wishlist_event_date_label() }))
			.toHaveAccessibleDescription(m.wishlist_event_date_prefilled_hint());
		await expect.element(themeTrigger(screen)).toHaveTextContent(christmasThemeName());
		await expect.element(screen.getByText(m.create_theme_suggested_hint())).toBeVisible();

		const input = await submitWithTitle(screen, 'Dárky pod stromeček');
		expect(input).toMatchObject({
			occasion: WISHLIST_OCCASION.christmas,
			eventDate: new Date(2026, 11, 24),
			themeId: 'christmas',
		});
	});

	it('keeps a date the user picked before choosing Vánoce', async () => {
		const screen = renderModal();

		const eventDateTrigger = await pickFirstAvailableDay(screen);
		const pickedDateText = eventDateTrigger.element().textContent;
		await screen.getByRole('radio', { name: m.wishlist_occasion_christmas() }).click();

		await expect.poll(() => eventDateTrigger.element().textContent).toBe(pickedDateText);
		await expect
			.element(eventDateTrigger)
			.toHaveAccessibleDescription(m.wishlist_event_date_helper());
	});

	it('drops only the pre-filled date when leaving Vánoce', async () => {
		const screen = renderModal();

		await screen.getByRole('radio', { name: m.wishlist_occasion_christmas() }).click();
		await screen.getByRole('radio', { name: m.wishlist_occasion_birthday() }).click();
		const input = await submitWithTitle(screen, 'Dárky');

		expect(input).toMatchObject({ occasion: WISHLIST_OCCASION.birthday, eventDate: null });
	});

	it('keeps a motif the user chose before choosing Vánoce', async () => {
		const screen = renderModal();
		const partyThemeName = wishlistThemeName('party');

		await themeTrigger(screen).click();
		await screen.getByRole('option', { name: partyThemeName }).click();
		await screen.getByRole('radio', { name: m.wishlist_occasion_christmas() }).click();

		await expect.element(themeTrigger(screen)).toHaveTextContent(partyThemeName);
		const input = await submitWithTitle(screen, 'Dárky');
		expect(input).toMatchObject({ occasion: WISHLIST_OCCASION.christmas, themeId: 'party' });
	});
});
