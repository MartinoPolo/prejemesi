import { test, expect } from '@playwright/test';
import { createTestUser, TEST_GIFT } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import {
	createWishlistForSomeoneAndNavigate,
	addGift,
	shareWishlist,
} from './fixtures/wishlist-helpers.js';

/**
 * Create-for-someone flow (issue #99, recipient + správce role model).
 *
 * A user creates a list "for someone else" (free-text recipient). The creator becomes the
 * first správce (moderator role), NOT the recipient — so the header leads with „Pro {recipient}"
 * + a „Spravuje {creator}" meta line, and the creator (a správce) DOES see reservation controls
 * (unlike a recipient, whose surprise is protected).
 */
test.describe('Create a wishlist for someone else', () => {
	test('header shows „Pro {recipient}" + „Spravuje {creator}" and the creator can reserve', async ({
		browser,
		request,
		baseURL,
	}) => {
		const creator = createTestUser('for-someone-creator');
		const page = await registerAndGetPage(browser, request, baseURL!, creator);

		const recipientName = 'Rosie';
		await createWishlistForSomeoneAndNavigate(page, {
			title: 'Vánoce pro Rosie',
			recipientName,
		});

		// ── Header variant A: recipient-first name slot + managed-by meta line ──────────
		const banner = page.getByTestId('wishlist-banner');

		// The prominent name slot reads „Pro Rosie" (prefix „Pro" is „For" in the en base locale).
		await expect(banner.getByText(/(Pro|For)\s+Rosie/)).toBeVisible({ timeout: 10_000 });

		// „Spravuje {creator}" / „Managed by {creator}" — the creator is the sole správce, and
		// their account name (createTestUser → „E2E for-someone-creator") appears in the meta row.
		await expect(
			banner.getByText(new RegExp(`(Spravuje|Managed by)\\s+${creator.name}`)),
		).toBeVisible({
			timeout: 10_000,
		});

		// ── Creator is a správce: reservation controls are visible + reservable ─────────
		// Add a gift and share so the reserve footer is meaningful, then assert the creator
		// sees the „Rezervovat" control (hardcoded CS aria-label, locale-independent).
		await addGift(page, TEST_GIFT.name);
		await shareWishlist(page);

		// The reserve button carries aria-label „Rezervovat {gift.name}" for visitors/správci.
		// `exact: true` is required: a správce also gets a drag-to-reorder wrapper (role="button")
		// around each card whose aggregated accessible name contains this label as a substring, so a
		// non-exact name match resolves to two elements (the wrapper + the real button).
		await expect(
			page.getByRole('button', { name: `Rezervovat ${TEST_GIFT.name}`, exact: true }),
		).toBeVisible({ timeout: 10_000 });

		await page.context().close();
	});
});
