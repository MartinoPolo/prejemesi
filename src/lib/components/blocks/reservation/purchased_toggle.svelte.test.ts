import { render } from 'vitest-browser-svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GiftForVisitor } from '$lib/modules/gifts/types.js';
import { overwriteGetLocale } from '$lib/paraglide/runtime.js';

const mocks = vi.hoisted(() => ({
	setReservationPurchased: vi.fn(),
	toastSuccess: vi.fn(),
	toastError: vi.fn(),
}));

vi.mock('$lib/modules/reservations/reservations.remote.js', () => ({
	setReservationPurchased: mocks.setReservationPurchased,
}));
vi.mock('$lib/components/base/toast/index.js', () => ({
	toastSuccess: mocks.toastSuccess,
	toastError: mocks.toastError,
}));

const { default: PurchasedToggleTestHost } = await import('./PurchasedToggleTestHost.svelte');

function makeGift(overrides: Partial<GiftForVisitor> = {}): GiftForVisitor {
	return {
		id: 'gift-1',
		wishlistId: 'wishlist-1',
		name: 'Kolo',
		description: null,
		descriptionAppends: [],
		editedAfterShareAt: null,
		links: [],
		price: null,
		priceMax: null,
		currency: null,
		imageUrl: null,
		imageKey: null,
		imageMeta: null,
		quantity: 1,
		sortOrder: 0,
		received: false,
		createdAt: new Date('2026-01-01'),
		priorityLevelId: null,
		priorityLabel: null,
		prioritySortOrder: null,
		likeCount: 0,
		reservedCount: 1,
		isFullyReserved: true,
		reserverNames: [],
		myReservationId: 'reservation-1',
		myReservationPurchasedAt: null,
		...overrides,
	};
}

afterEach(() => {
	overwriteGetLocale(() => 'cs');
	vi.clearAllMocks();
});

describe('PurchasedToggle', () => {
	it.each([
		{
			locale: 'cs' as const,
			purchased: false,
			visible: 'Koupeno',
			accessible: 'Označit jako koupené',
		},
		{
			locale: 'cs' as const,
			purchased: true,
			visible: 'Nekoupeno',
			accessible: 'Označit jako nekoupené',
		},
		{
			locale: 'en' as const,
			purchased: false,
			visible: 'Bought',
			accessible: 'Mark as bought',
		},
		{
			locale: 'en' as const,
			purchased: true,
			visible: 'Not bought',
			accessible: 'Mark as not bought',
		},
	])(
		'uses the $locale $visible direction label and state-specific shared intent',
		async ({ locale, purchased, visible, accessible }) => {
			overwriteGetLocale(() => locale);
			const screen = await render(PurchasedToggleTestHost, {
				gift: makeGift({
					myReservationPurchasedAt: purchased ? new Date('2026-01-02') : null,
				}),
			});
			const action = screen.getByRole('button', { name: accessible }).element();

			expect(action.textContent?.trim()).toBe(visible);
			expect(action.getAttribute('aria-pressed')).toBe(String(purchased));
			if (purchased) {
				expect(action.querySelector('.border-status-danger')).toBeTruthy();
				expect(action.querySelector('.lucide-undo-2[aria-hidden="true"]')).toBeTruthy();
			} else {
				expect(action.querySelector('.bg-foreground')).toBeTruthy();
				expect(action.querySelector('svg')).toBeNull();
			}
		},
	);

	it.each([
		{ isAuthenticated: false, reservationId: 'reservation-1' },
		{ isAuthenticated: true, reservationId: null },
	])(
		'requires authentication and an owned reservation',
		async ({ isAuthenticated, reservationId }) => {
			await render(PurchasedToggleTestHost, {
				gift: makeGift({ myReservationId: reservationId }),
				isAuthenticated,
			});

			expect(document.querySelector('[aria-pressed]')).toBeNull();
		},
	);

	it('optimistically changes direction, blocks replay, and remains changed after success', async () => {
		let settle!: () => void;
		mocks.setReservationPurchased.mockReturnValue(
			new Promise<void>((resolve) => {
				settle = resolve;
			}),
		);
		const screen = await render(PurchasedToggleTestHost, { gift: makeGift() });
		const forward = screen.getByRole('button', { name: 'Označit jako koupené' });

		await forward.click();
		const reverse = screen.getByRole('button', { name: 'Označit jako nekoupené' });
		await expect.element(reverse).toBeDisabled();
		await reverse.click({ force: true });
		expect(mocks.setReservationPurchased).toHaveBeenCalledOnce();
		expect(mocks.setReservationPurchased).toHaveBeenCalledWith({
			reservationId: 'reservation-1',
			purchased: true,
		});
		settle();
		await expect.element(reverse).toBeEnabled();
		await expect.element(reverse).toHaveAttribute('aria-pressed', 'true');
	});

	it('rolls back the optimistic direction and reports an error when saving fails', async () => {
		mocks.setReservationPurchased.mockRejectedValue(new Error('failed'));
		const screen = await render(PurchasedToggleTestHost, { gift: makeGift() });

		await screen.getByRole('button', { name: 'Označit jako koupené' }).click();

		await expect
			.element(screen.getByRole('button', { name: 'Označit jako koupené' }))
			.toBeEnabled();
		expect(mocks.toastError).toHaveBeenCalledOnce();
	});
});
