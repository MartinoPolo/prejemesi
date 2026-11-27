import '../../../../app.css';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { GIFT_LINK_GROUP_KIND } from '$lib/modules/gifts/gift_link_group_kind.js';
import type { SharedGiftMember } from '$lib/modules/gifts/types.js';
import { recipientShapedGift } from '$lib/modules/gifts/gift_ordering.test_fixtures.js';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import * as m from '$lib/paraglide/messages.js';
import GiftSharedBadge from './GiftSharedBadge.svelte';
import {
	cleanupCardHosts,
	makeVisitorGift,
	renderCardInGridColumn,
} from './gift_card.test_fixtures.js';

// The avatar's image frame transitively reads `$env/dynamic/public`.
vi.mock('$env/dynamic/public', () => ({ env: {} }));

const anicka: SharedGiftMember = {
	recipientDisplayName: 'Anička',
	recipientImage: null,
	giftId: 'gift-anicka',
	wishlistId: 'wishlist-anicka',
	wishlistShortId: 'anicka-vanoce',
	wishlistTitle: 'Aniččiny Vánoce',
};

const anonymousAnicka: SharedGiftMember = {
	...anicka,
	giftId: null,
	wishlistId: null,
	wishlistShortId: null,
	wishlistTitle: null,
};

function sharedGift(sharedWith: SharedGiftMember[], quantity = 3) {
	return makeVisitorGift({
		linkGroupKind: GIFT_LINK_GROUP_KIND.sharedAcrossRecipients,
		sharedWith,
		quantity,
	});
}

const badgeLabel = m.gift_shared_badge_aria({ names: 'Anička' });

/** The fixed tail of a message after its `{names}` placeholder, whatever the locale. */
function textAfterNames(message: (inputs: { names: string }) => string): string {
	const placeholder = '<names>';
	return message({ names: placeholder }).split(placeholder).at(-1)!.trim();
}

const gifterReservingText = textAfterNames(m.gift_shared_explanation_gifter_pair);

afterEach(async () => {
	cleanupCardHosts();
	await page.viewport(1280, 760);
});

describe('shared gift on a card (issue #737)', () => {
	it('shows the badge and the shared total quantity on the card', async () => {
		const host = await renderCardInGridColumn(
			sharedGift([anonymousAnicka]),
			WISHLIST_ROLES.visitor,
		);
		const badge = host.querySelector('[data-slot="gift-shared-badge"]');
		expect(badge?.getAttribute('aria-label')).toBe(badgeLabel);
		expect(host.querySelector('[data-testid="gift-piece-count"]')?.textContent?.trim()).toBe(
			m.gift_shared_card_quantity({ count: 3 }),
		);
	});

	it('shows no badge for a gift that is not shared', async () => {
		const host = await renderCardInGridColumn(makeVisitorGift(), WISHLIST_ROLES.visitor);
		expect(host.querySelector('[data-slot="gift-shared-badge"]')).toBeNull();
	});
});

describe('GiftSharedBadge', () => {
	it('explains to a gifter that one reservation gives the gift to everyone', async () => {
		await page.viewport(1280, 760);
		const screen = await render(GiftSharedBadge, {
			gift: sharedGift([anonymousAnicka]),
			role: WISHLIST_ROLES.visitor,
		});
		const trigger = screen.getByRole('button', { name: badgeLabel });
		await expect.element(trigger).toHaveAttribute('aria-expanded', 'false');
		await trigger.click();

		const popover = page.getByRole('dialog', { name: m.gift_shared_explanation_title() });
		await expect.element(popover).toBeVisible();
		await expect.element(trigger).toHaveAttribute('aria-expanded', 'true');
		await expect
			.element(popover.getByTestId('gift-shared-explanation-text'))
			.toHaveTextContent(gifterReservingText);
		await expect
			.element(popover.getByTestId('gift-shared-explanation-quantity'))
			.toHaveTextContent(m.gift_shared_quantity_total_pair_not_each({ count: 3 }));
		// A visitor learns who else wishes for the gift, never which list it is on.
		await expect.element(popover.getByTestId('gift-shared-lists')).not.toBeInTheDocument();
		await screen.unmount();
	});

	it('links the other list only for a viewer who manages it', async () => {
		await page.viewport(1280, 760);
		const screen = await render(GiftSharedBadge, {
			gift: sharedGift([anicka]),
			role: WISHLIST_ROLES.moderator,
		});
		await screen.getByRole('button', { name: badgeLabel }).click();
		const popover = page.getByRole('dialog', { name: m.gift_shared_explanation_title() });
		await expect
			.element(popover.getByRole('link', { name: 'Aniččiny Vánoce' }))
			.toHaveAttribute('href', expect.stringContaining('/w/anicka-vanoce'));
		await screen.unmount();
	});

	it('never mentions reserving to a recipient', async () => {
		await page.viewport(1280, 760);
		const screen = await render(GiftSharedBadge, {
			gift: recipientShapedGift(sharedGift([anonymousAnicka])),
			role: WISHLIST_ROLES.recipient,
		});
		await screen.getByRole('button', { name: badgeLabel }).click();
		const popover = page.getByRole('dialog', { name: m.gift_shared_explanation_title() });
		await expect.element(popover).toBeVisible();
		await expect.element(popover).not.toHaveTextContent(gifterReservingText);
		await expect
			.element(popover)
			.not.toHaveTextContent(textAfterNames(m.gift_shared_explanation_gifter_group));
		await expect
			.element(popover.getByTestId('gift-shared-explanation-progress'))
			.not.toBeInTheDocument();
		await screen.unmount();
	});

	it('opens the explanation in a bottom sheet on a narrow screen', async () => {
		await page.viewport(390, 760);
		const screen = await render(GiftSharedBadge, {
			gift: sharedGift([anonymousAnicka]),
			role: WISHLIST_ROLES.visitor,
		});
		await screen.getByRole('button', { name: badgeLabel }).click();
		const sheet = page.getByRole('dialog', { name: m.gift_shared_explanation_title() });
		await expect.element(sheet).toBeVisible();
		await sheet.getByRole('button', { name: m.close() }).last().click();
		await expect.element(sheet).not.toBeInTheDocument();
		await screen.unmount();
	});

	it('keeps the compact badge readable in a narrow tile instead of truncating a name', async () => {
		const host = document.createElement('div');
		host.style.width = '96px';
		document.body.append(host);
		const longName = { ...anonymousAnicka, recipientDisplayName: 'Maximilián Novotný' };
		const screen = render(GiftSharedBadge, {
			target: host,
			props: { gift: sharedGift([longName]), role: WISHLIST_ROLES.visitor, compact: true },
		});
		const badge = screen.getByRole('button', {
			name: m.gift_shared_badge_aria({ names: longName.recipientDisplayName }),
		});
		await expect.element(badge).toBeVisible();
		const truncatedParts = [...badge.element().querySelectorAll('span')].filter(
			(part) =>
				getComputedStyle(part).textOverflow === 'ellipsis' &&
				part.scrollWidth > part.clientWidth,
		);
		expect(truncatedParts).toEqual([]);
		await screen.unmount();
		host.remove();
	});

	it('stays a static label while selection or reorder owns the press', async () => {
		const screen = await render(GiftSharedBadge, {
			gift: sharedGift([anonymousAnicka]),
			role: WISHLIST_ROLES.visitor,
			interactive: false,
		});
		await expect.element(screen.getByRole('img', { name: badgeLabel })).toBeVisible();
		await expect.element(screen.getByRole('button')).not.toBeInTheDocument();
		await screen.unmount();
	});
});
