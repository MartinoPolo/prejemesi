// Multi-category badge lane (#529, designs/multi-category-badges variant A): what fits in order,
// then a "+X" button whose popover lists every category; one category stays the clamped badge.
import '../../../../app.css';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import type { PublicGiftCategory } from '$lib/modules/gift-categories/types.js';
import type { GiftForVisitor } from '$lib/modules/gifts/types.js';
import { WISHLIST_ROLES, type WishlistRole } from '$lib/modules/wishlists/types.js';
import * as m from '$lib/paraglide/messages.js';
import {
	GiftCardTestHost,
	cleanupCardHosts,
	fixedHosts,
	makeVisitorGift,
} from './gift_card.test_fixtures.js';
import { GiftListItemTestHost } from './gift_list_item.test_fixtures.js';

const LABELS = ['Elektronika', 'Cestování', 'Hudba a poslech', 'Dárky pro kutily'];

function categoriesFor(labels: readonly string[]): PublicGiftCategory[] {
	return labels.map((label, index) => ({
		id: `category-${index}`,
		presetKey: null,
		customLabel: label,
		color: index % 2 === 0 ? '#0369A1' : '#F59E0B',
		sortOrder: index,
	}));
}

function categorizedGift(labels: readonly string[]): GiftForVisitor {
	const categories = categoriesFor(labels);
	return makeVisitorGift({
		categoryIds: categories.map((category) => category.id),
		categories,
		myReservationId: null,
		reservedCount: 0,
	});
}

interface RenderOptions {
	view?: 'card' | 'list';
	width: number;
	role?: WishlistRole;
	onopen?: () => void;
}

/** Mounts the gift inside a press target standing in for the wishlist's card wrapper. */
async function renderGift(gift: GiftForVisitor, options: RenderOptions) {
	const { view = 'card', width, role = WISHLIST_ROLES.recipient, onopen } = options;
	await page.viewport(Math.max(width + 40, 390), 900);
	const host = document.createElement('div');
	host.style.width = `${width}px`;
	host.dataset.palette = 'sky';
	if (onopen !== undefined) {
		host.addEventListener('click', onopen);
	}
	document.body.appendChild(host);
	fixedHosts.add(host);
	await render(
		view === 'card' ? GiftCardTestHost : GiftListItemTestHost,
		{ gift, role },
		{ baseElement: host },
	);
	return host;
}

function visibleBadgeLabels(host: HTMLElement): string[] {
	const lane = host.querySelector<HTMLElement>('[data-testid="gift-category-badges"]');
	const badges = lane
		? lane.querySelectorAll(':scope > :not([aria-hidden]) [data-testid="gift-category-badge"]')
		: host.querySelectorAll('[data-testid="gift-category-badge"]');
	return Array.from(badges, (badge) => badge.textContent?.trim() ?? '');
}

/** Text an assistive technology reads: everything outside aria-hidden subtrees. */
function accessibleText(root: Element): string {
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	const parts: string[] = [];
	for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
		if (node.parentElement?.closest('[aria-hidden="true"]') == null) {
			parts.push(node.textContent ?? '');
		}
	}
	return parts.join(' ');
}

function moreButton(count: number) {
	return page.getByRole('button', { name: m.gift_category_more_label({ count }) });
}

afterEach(() => {
	cleanupCardHosts();
	document.body.querySelectorAll('[data-slot="popover-content"]').forEach((popover) => {
		popover.remove();
	});
});

describe('GiftCategoryBadges', () => {
	it('keeps a lone category as the two-line clamped badge without "+X"', async () => {
		const host = await renderGift(
			categorizedGift(['Velmi dlouhá kategorie pro celou rodinu']),
			{
				width: 220,
			},
		);

		const badges = host.querySelectorAll<HTMLElement>('[data-testid="gift-category-badge"]');
		expect(badges).toHaveLength(1);
		expect(getComputedStyle(badges[0]!).webkitLineClamp).toBe('2');
		expect(host.querySelector('[data-testid="gift-category-more"]')).toBeNull();
	});

	it('shows every category on one line when the lane is wide enough', async () => {
		const host = await renderGift(categorizedGift(LABELS.slice(0, 2)), { width: 360 });

		await expect.poll(() => visibleBadgeLabels(host)).toEqual(LABELS.slice(0, 2));
		expect(host.querySelector('[data-testid="gift-category-more"]')).toBeNull();
	});

	it('shows leading one-line badges in order and collapses the rest into "+X" on a narrow card', async () => {
		const host = await renderGift(categorizedGift(LABELS), { width: 220 });

		await expect.poll(() => visibleBadgeLabels(host).length).toBeLessThan(LABELS.length);
		const shown = visibleBadgeLabels(host);
		expect(shown.length).toBeGreaterThan(0);
		expect(shown).toEqual(LABELS.slice(0, shown.length));
		await expect.element(moreButton(LABELS.length - shown.length)).toBeVisible();
		for (const badge of host.querySelectorAll<HTMLElement>(
			'[data-testid="gift-category-badges"] > :not([aria-hidden]) [data-testid="gift-category-badge"]',
		)) {
			expect(getComputedStyle(badge).whiteSpace).toBe('nowrap');
		}
		const lane = host.querySelector<HTMLElement>('[data-testid="gift-category-badges"]')!;
		const more = moreButton(LABELS.length - shown.length).element();
		expect(more.getBoundingClientRect().right).toBeLessThanOrEqual(
			lane.getBoundingClientRect().right + 0.5,
		);
	});

	it('keeps every category name available to assistive technology', async () => {
		const host = await renderGift(categorizedGift(LABELS), { width: 220 });
		await expect.poll(() => visibleBadgeLabels(host).length).toBeLessThan(LABELS.length);

		const lane = page.getByRole('group', { name: m.gift_category_label() }).element();
		const spokenText = accessibleText(lane);
		for (const label of LABELS) {
			expect(spokenText).toContain(label);
		}
		expect(spokenText.match(/Elektronika/g)).toHaveLength(1);
	});

	it('opens a popover listing every category from "+X" without opening the card', async () => {
		const onopen = vi.fn();
		const host = await renderGift(categorizedGift(LABELS), { width: 220, onopen });
		await expect.poll(() => visibleBadgeLabels(host).length).toBeLessThan(LABELS.length);
		const hiddenCount = LABELS.length - visibleBadgeLabels(host).length;

		await userEvent.click(moreButton(hiddenCount));

		const popover = page.getByRole('dialog');
		await expect.element(popover).toBeVisible();
		await expect.element(popover).toHaveAccessibleName(m.gift_category_more_title());
		const listed = Array.from(
			popover.element().querySelectorAll('[data-testid="gift-category-badge"]'),
			(badge) => badge.textContent?.trim(),
		);
		expect(listed).toEqual(LABELS);
		expect(onopen).not.toHaveBeenCalled();
	});

	it('gives a too-narrow primary the whole List lane and moves "+X" below it', async () => {
		const host = await renderGift(
			categorizedGift(['Výpravné ilustrované edice', 'Knihy', 'Hry']),
			{ view: 'list', width: 320 },
		);
		const lane = host.querySelector<HTMLElement>('[data-testid="gift-category-badges"]')!;
		await expect.poll(() => lane.querySelector('[data-more-on-own-line]')).not.toBeNull();

		const primary = lane.querySelector<HTMLElement>(
			':scope > :not([aria-hidden]) [data-testid="gift-category-badge"]',
		)!;
		const more = moreButton(2).element();
		expect(more.getBoundingClientRect().top).toBeGreaterThanOrEqual(
			primary.getBoundingClientRect().bottom,
		);
		expect(primary.getBoundingClientRect().right).toBeLessThanOrEqual(
			lane.getBoundingClientRect().right + 0.5,
		);
	});

	it('keeps "+X" static so a selecting or reordering press reaches the card', async () => {
		const host = document.createElement('div');
		host.style.width = '220px';
		document.body.appendChild(host);
		fixedHosts.add(host);
		await render(
			GiftCardTestHost,
			{ gift: categorizedGift(LABELS), role: WISHLIST_ROLES.recipient, contextualMode: true },
			{ baseElement: host },
		);
		await expect.poll(() => visibleBadgeLabels(host).length).toBeLessThan(LABELS.length);

		expect(host.querySelector('[data-testid="gift-category-badges"] button')).toBeNull();
		const lane = host.querySelector('[data-testid="gift-category-badges"]')!;
		for (const label of LABELS) {
			expect(accessibleText(lane)).toContain(label);
		}
	});
});
