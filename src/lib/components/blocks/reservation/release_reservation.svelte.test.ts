// Release-control suite (issue #213, phase B). The hostile-name case measures real computed
// geometry, so the compiled Tailwind utilities must be present (mirrors reserve_modal.svelte.test.ts).
import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import type { GiftForVisitor } from '$lib/modules/gifts/types.js';
import type { ReservationForModerator } from '$lib/modules/reservations/types.js';
import {
	RESERVATION_RELEASE_CAPABILITY,
	type ReservationReleaseCapability,
} from '$lib/modules/wishlists/wishlist_capabilities.js';

vi.mock('$env/dynamic/public', () => ({ env: {} }));

const { default: ReleaseReservationTestHost } = await import('./ReleaseReservationTestHost.svelte');

const GIFT_NAME = 'Bezdrátová sluchátka';

// Single unbroken 90-char token (issue #210/#211 fixture) carrying an HTML payload: an
// anonymous gifter names themself, so the picker renders attacker-controlled text.
const HOSTILE_GIFTER_NAME = `<img src=x onerror="alert(1)">${'x'.repeat(60)}`;

function makeGift(overrides: Partial<GiftForVisitor> = {}): GiftForVisitor {
	return {
		id: 'gift-1',
		wishlistId: 'wishlist-1',
		name: GIFT_NAME,
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
		createdAt: new Date('2026-01-01T00:00:00Z'),
		priorityLevelId: null,
		priorityLabel: null,
		prioritySortOrder: null,
		likeCount: 0,
		reservedCount: 1,
		isFullyReserved: true,
		reserverNames: [],
		myReservationId: null,
		myReservationPurchasedAt: null,
		...overrides,
	};
}

function makeReservation(
	overrides: Partial<ReservationForModerator> = {},
): ReservationForModerator {
	return {
		id: 'reservation-1',
		giftId: 'gift-1',
		quantity: 1,
		displayName: 'Petr Svoboda',
		releasable: true,
		createdAt: new Date('2026-02-03T14:30:00Z'),
		...overrides,
	};
}

async function renderRelease(options: {
	capability: ReservationReleaseCapability;
	reservations: ReservationForModerator[];
	gift?: GiftForVisitor;
	release?: (giftId: string, reservationId: string) => Promise<boolean>;
}) {
	return render(ReleaseReservationTestHost, {
		gift: options.gift ?? makeGift(),
		capability: options.capability,
		reservations: options.reservations,
		release: options.release ?? (async () => true),
	});
}

/** Opens the release flow: clicks the control that ReleaseReservationButton renders. */
async function openReleaseFlow() {
	await page.getByTestId('release-reservation-button').click();
}

describe('release control visibility (issue #213 REQ-3/REQ-7)', () => {
	it('renders no release control for a viewer without the capability', async () => {
		await renderRelease({
			capability: RESERVATION_RELEASE_CAPABILITY.none,
			reservations: [makeReservation()],
		});

		expect(document.querySelector('[data-testid="release-reservation-button"]')).toBeNull();
	});

	it('renders the release control when the gift holds a reservation this viewer may release', async () => {
		const screen = await renderRelease({
			capability: RESERVATION_RELEASE_CAPABILITY.any,
			reservations: [makeReservation()],
		});

		await expect.element(screen.getByTestId('release-reservation-button')).toBeVisible();
	});

	it('hides the release control when the gift holds nothing for this viewer to act on', async () => {
		// The server already strips the viewer's OWN reservation from the ledger, so an empty
		// ledger is exactly the own-only case: cancelling stays on the reserve control.
		await renderRelease({
			capability: RESERVATION_RELEASE_CAPABILITY.any,
			reservations: [],
		});

		expect(document.querySelector('[data-testid="release-reservation-button"]')).toBeNull();
	});
});

describe('release picker (issue #213 REQ-4)', () => {
	it('lists gifter name, quantity and reservation time for every row when the gift holds several', async () => {
		await renderRelease({
			capability: RESERVATION_RELEASE_CAPABILITY.any,
			reservations: [
				makeReservation({ id: 'reservation-1', displayName: 'Petr Svoboda', quantity: 2 }),
				makeReservation({
					id: 'reservation-2',
					displayName: 'Babička Marie',
					quantity: 3,
					createdAt: new Date('2026-04-05T09:15:00Z'),
				}),
			],
		});

		await openReleaseFlow();

		const rows = document.querySelectorAll('[data-testid="release-reservation-row"]');
		expect(rows).toHaveLength(2);
		expect(rows[0]!.textContent).toContain('Petr Svoboda');
		expect(rows[0]!.textContent).toContain('2');
		expect(rows[0]!.textContent).toContain('2026');
		expect(rows[1]!.textContent).toContain('Babička Marie');
		expect(rows[1]!.textContent).toContain('3');
		expect(rows[1]!.textContent).toContain('2026');
	});

	it('skips the picker and goes straight to the confirmation when the gift holds exactly one', async () => {
		await renderRelease({
			capability: RESERVATION_RELEASE_CAPABILITY.any,
			reservations: [makeReservation()],
		});

		await openReleaseFlow();

		await expect.element(page.getByTestId('release-reservation-confirm')).toBeVisible();
		expect(document.querySelectorAll('[data-testid="release-reservation-row"]')).toHaveLength(
			0,
		);
	});

	it('shows a správce a signed-in gifter row it may see but not release, with the reason', async () => {
		await renderRelease({
			capability: RESERVATION_RELEASE_CAPABILITY.guestOnly,
			reservations: [
				makeReservation({ id: 'reservation-1', displayName: 'Babička Marie' }),
				makeReservation({
					id: 'reservation-2',
					displayName: 'Petr Svoboda',
					releasable: false,
				}),
			],
		});

		await openReleaseFlow();

		const blockedRow = document.querySelector(
			'[data-testid="release-reservation-row"][data-reservation-id="reservation-2"]',
		) as HTMLElement;
		const blockedAction = blockedRow.querySelector(
			'[data-testid="release-reservation-row-action"]',
		) as HTMLButtonElement;

		expect(blockedRow.textContent).toContain('Petr Svoboda');
		expect(blockedAction.disabled).toBe(true);
		expect(blockedRow.textContent).toContain('jen administrátor');
	});

	it('falls back to a localized placeholder when the gifter account was deleted', async () => {
		await renderRelease({
			capability: RESERVATION_RELEASE_CAPABILITY.any,
			reservations: [
				makeReservation({ id: 'reservation-1', displayName: null }),
				makeReservation({ id: 'reservation-2', displayName: 'Babička Marie' }),
			],
		});

		await openReleaseFlow();

		const row = document.querySelector(
			'[data-testid="release-reservation-row"][data-reservation-id="reservation-1"]',
		) as HTMLElement;
		expect(row.textContent).toContain('Smazaný účet');
	});

	it('renders a hostile anonymous name as inert text inside the dialog box', async () => {
		await renderRelease({
			capability: RESERVATION_RELEASE_CAPABILITY.any,
			reservations: [
				makeReservation({ id: 'reservation-1', displayName: HOSTILE_GIFTER_NAME }),
				makeReservation({ id: 'reservation-2', displayName: 'Babička Marie' }),
			],
		});

		await openReleaseFlow();

		const contentEl = document.querySelector('[data-slot="dialog-content"]') as HTMLElement;
		const nameEl = document.querySelector(
			'[data-testid="release-reservation-row-name"]',
		) as HTMLElement;

		// Escaped, not parsed: the payload survives verbatim as text and injects no element.
		expect(nameEl.textContent).toBe(HOSTILE_GIFTER_NAME);
		expect(contentEl.querySelector('img')).toBeNull();
		// …and the unbreakable 60-char run cannot drag the row past the dialog's own box.
		expect(nameEl.getBoundingClientRect().right).toBeLessThanOrEqual(
			contentEl.getBoundingClientRect().right + 0.5,
		);
	});
});

describe('release confirmation (issue #213 REQ-8)', () => {
	it('names both the gifter and the gift before the release takes effect', async () => {
		await renderRelease({
			capability: RESERVATION_RELEASE_CAPABILITY.any,
			reservations: [makeReservation({ displayName: 'Petr Svoboda' })],
		});

		await openReleaseFlow();

		const confirmEl = document.querySelector(
			'[data-testid="release-reservation-confirm"]',
		) as HTMLElement;
		expect(confirmEl.textContent).toContain('Petr Svoboda');
		expect(confirmEl.textContent).toContain(GIFT_NAME);
	});

	it('releases only the picked reservation once the confirmation is accepted', async () => {
		const release = vi.fn(async () => true);
		await renderRelease({
			capability: RESERVATION_RELEASE_CAPABILITY.any,
			reservations: [
				makeReservation({ id: 'reservation-1', displayName: 'Petr Svoboda' }),
				makeReservation({ id: 'reservation-2', displayName: 'Babička Marie' }),
			],
			release,
		});

		await openReleaseFlow();
		await page
			.getByTestId('release-reservation-row')
			.nth(1)
			.getByTestId('release-reservation-row-action')
			.click();
		await page.getByTestId('release-reservation-confirm-action').click();

		expect(release).toHaveBeenCalledExactlyOnceWith('gift-1', 'reservation-2');
	});
});
