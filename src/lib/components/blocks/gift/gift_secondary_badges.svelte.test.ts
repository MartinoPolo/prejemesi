import '../../../../app.css';
import { afterEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { WISHLIST_ROLES, type WishlistRole } from '$lib/modules/wishlists/types.js';
import type { GiftForVisitor } from '$lib/modules/gifts/types.js';
import * as m from '$lib/paraglide/messages.js';
import {
	GiftCardTestHost,
	cleanupCardHosts,
	fixedHosts,
	makeVisitorGift,
} from './gift_card.test_fixtures.js';
import { GiftListItemTestHost } from './gift_list_item.test_fixtures.js';
import { COMPARISON_CATEGORY, PAINTED_GIFT_IMAGE_URL } from './gift_comparison_fixtures.js';

type GiftView = 'card' | 'list';

// Approved unavailable treatment (designs/unavailable-gift-comparison, DECISIONS 2026-09-24):
// ordinary content and secondary badges keep 50% visibility; state and actions stay crisp.
const RETAINED_CONTENT_VISIBILITY = 0.5;

const reservationStates = {
	available: {
		received: false,
		reservedCount: 0,
		isFullyReserved: false,
		myReservationId: null,
		myReservationPurchasedAt: null,
		reserverNames: [],
	},
	reservedByOthers: {
		received: false,
		reservedCount: 2,
		isFullyReserved: true,
		myReservationId: null,
		myReservationPurchasedAt: null,
		reserverNames: ['Babička'],
	},
	reservedByMe: {
		received: false,
		reservedCount: 2,
		isFullyReserved: true,
		myReservationId: 'reservation-mine',
		myReservationPurchasedAt: null,
		reserverNames: [],
	},
	received: {
		received: true,
		reservedCount: 0,
		isFullyReserved: false,
		myReservationId: null,
		myReservationPurchasedAt: null,
		reserverNames: [],
	},
} satisfies Record<string, Partial<GiftForVisitor>>;

type ReservationState = keyof typeof reservationStates;

function comparisonGift(
	state: ReservationState,
	imageUrl: string | null = PAINTED_GIFT_IMAGE_URL,
): GiftForVisitor {
	return makeVisitorGift({
		name: 'Bezdrátová sluchátka',
		description: 'Tichá sluchátka na cesty',
		links: [{ url: 'https://www.alza.cz/sluchatka' }],
		price: 1490,
		currency: 'CZK',
		imageUrl,
		categoryId: COMPARISON_CATEGORY.id,
		category: COMPARISON_CATEGORY,
		priorityLabel: 'Vysoka',
		quantity: 2,
		likeCount: 3,
		...reservationStates[state],
	});
}

const contentSelectors: Record<GiftView, Record<string, string>> = {
	card: {
		image: '[data-testid="gift-card-crop-composition"] [data-testid="image-frame"]',
		title: 'h3',
		quantity: '[data-testid="gift-piece-count"]',
		description: '[data-testid="gift-card-description-stack"] p',
		link: '[data-testid="gift-card-links"] a',
		price: '[data-testid="gift-card-price"] span',
		category: '[data-testid="gift-category-badge"]',
		priority: '[data-testid="gift-priority-badge"]',
	},
	list: {
		image: '[data-testid="gift-list-square-composition"] [data-testid="image-frame"]',
		title: 'h3',
		quantity: '[data-testid="gift-piece-count"]',
		description: '.gift-list-description',
		link: '[data-testid="gift-link-list"] a',
		price: '[data-testid="gift-list-price"]',
		category: '[data-testid="gift-category-badge"]',
		priority: '[data-testid="gift-priority-badge"]',
	},
};

interface RenderOptions {
	role?: WishlistRole;
	hideReservationState?: boolean;
	width?: number;
	dark?: boolean;
	withMore?: boolean;
}

async function renderGift(view: GiftView, gift: GiftForVisitor, options: RenderOptions = {}) {
	const {
		role = WISHLIST_ROLES.visitor,
		hideReservationState = role === WISHLIST_ROLES.recipient,
		width = 900,
		dark = false,
		withMore = true,
	} = options;
	await page.viewport(width, 900);
	const host = document.createElement('div');
	host.style.width = `${width === 390 ? 320 : view === 'card' ? 280 : 640}px`;
	host.dataset.palette = 'sky';
	host.classList.toggle('dark', dark);
	document.body.appendChild(host);
	fixedHosts.add(host);
	const props = {
		gift,
		role,
		hideReservationState,
		onreceived: () => {},
		onreserve: () => {},
		onunreserve: () => {},
		...(withMore ? { onmore: () => {} } : {}),
	};
	const screen = await render(view === 'card' ? GiftCardTestHost : GiftListItemTestHost, props, {
		baseElement: host,
	});
	return { host, screen, props };
}

function element(host: HTMLElement, selector: string): HTMLElement {
	const found = host.querySelector<HTMLElement>(selector);
	expect(found, selector).not.toBeNull();
	return found!;
}

/** Visibility the viewer actually sees: opacity multiplies down the ancestor chain. */
function effectiveOpacity(target: Element, host: HTMLElement): number {
	let opacity = 1;
	for (let current: Element | null = target; current !== null; current = current.parentElement) {
		opacity *= Number(getComputedStyle(current).opacity);
		if (current === host) {
			break;
		}
	}
	return opacity;
}

function expectContentVisibility(host: HTMLElement, view: GiftView, visibility: number) {
	for (const [layer, selector] of Object.entries(contentSelectors[view])) {
		expect(effectiveOpacity(element(host, selector), host), layer).toBeCloseTo(visibility, 3);
	}
	for (const badge of ['category', 'priority']) {
		expect(getComputedStyle(element(host, contentSelectors[view][badge])).filter, badge).toBe(
			'none',
		);
	}
}

function expectControlsCrisp(host: HTMLElement) {
	const buttons = Array.from(host.querySelectorAll<HTMLElement>('button'));
	expect(buttons.length).toBeGreaterThan(0);
	for (const button of buttons) {
		const label = button.getAttribute('aria-label') ?? button.textContent?.trim();
		expect(effectiveOpacity(button, host), label ?? 'button').toBe(1);
	}
}

function expectStateCrisp(host: HTMLElement) {
	const overlay = element(host, '[data-testid="gift-state-overlay"]');
	for (const pill of overlay.querySelectorAll<HTMLElement>(':scope > span')) {
		expect(effectiveOpacity(pill, host), pill.textContent ?? '').toBe(1);
		expect(getComputedStyle(pill).filter).toBe('none');
	}
}

function expectNoVeil(host: HTMLElement) {
	expect(host.querySelector('[data-testid="gift-reserved-veil"]')).toBeNull();
	expect(host.querySelector('[class*="veil"]')).toBeNull();
}

function shadowGeometry(boxShadow: string): string[] {
	return boxShadow.match(/-?[\d.]+px/g) ?? [];
}

interface FramePaint {
	borderColor: string;
	borderWidth: string;
	outlineCorrectionColor: string | null;
	boxShadow: string;
	separatorColor: string;
	separatorThickness: string;
}

function framePaint(host: HTMLElement, view: GiftView): FramePaint {
	if (view === 'card') {
		const surface = element(host, '[data-slot="elevation-surface"]');
		const separator = element(host, '[data-testid="gift-card-image-separator"]');
		const surfaceStyle = getComputedStyle(surface);
		return {
			borderColor: surfaceStyle.borderTopColor,
			borderWidth: surfaceStyle.borderTopWidth,
			outlineCorrectionColor: getComputedStyle(surface, '::after').borderTopColor,
			boxShadow: surfaceStyle.boxShadow,
			separatorColor: getComputedStyle(separator).backgroundColor,
			separatorThickness: getComputedStyle(separator).height,
		};
	}
	const item = getComputedStyle(element(host, '[data-testid="gift-list-item"]'));
	const image = getComputedStyle(element(host, '[data-testid="gift-list-image"]'));
	return {
		borderColor: item.borderTopColor,
		borderWidth: item.borderTopWidth,
		outlineCorrectionColor: null,
		boxShadow: item.boxShadow,
		separatorColor: image.borderRightColor,
		separatorThickness: image.borderRightWidth,
	};
}

function expectSoftenedFrame(available: FramePaint, unavailable: FramePaint) {
	expect(unavailable.borderColor).not.toBe(available.borderColor);
	expect(unavailable.separatorColor).not.toBe(available.separatorColor);
	expect(unavailable.boxShadow).not.toBe(available.boxShadow);
	expect(unavailable.borderWidth).toBe(available.borderWidth);
	expect(unavailable.separatorThickness).toBe(available.separatorThickness);
	expect(shadowGeometry(unavailable.boxShadow)).toEqual(shadowGeometry(available.boxShadow));
	for (const paint of [available, unavailable]) {
		expect(paint.separatorColor).toBe(paint.borderColor);
		if (paint.outlineCorrectionColor !== null) {
			expect(paint.outlineCorrectionColor).toBe(paint.borderColor);
		}
	}
}

afterEach(cleanupCardHosts);

describe('unavailable gift treatment', () => {
	it.each([
		{ view: 'card' as const, width: 390 },
		{ view: 'card' as const, width: 900 },
		{ view: 'list' as const, width: 390 },
		{ view: 'list' as const, width: 900 },
	])(
		'fades content and badges once while state and actions stay crisp in $view at $width px',
		async ({ view, width }) => {
			for (const imageUrl of [PAINTED_GIFT_IMAGE_URL, null]) {
				for (const dark of [false, true]) {
					const { host: available } = await renderGift(
						view,
						comparisonGift('available', imageUrl),
						{ width, dark },
					);
					const { host: unavailable } = await renderGift(
						view,
						comparisonGift('reservedByOthers', imageUrl),
						{ width, dark },
					);

					expectContentVisibility(available, view, 1);
					expectControlsCrisp(available);
					expect(
						available.querySelector('[data-testid="gift-state-overlay"]'),
					).toBeNull();

					expectContentVisibility(unavailable, view, RETAINED_CONTENT_VISIBILITY);
					expectControlsCrisp(unavailable);
					expectStateCrisp(unavailable);
					expectNoVeil(unavailable);
					expect(element(unavailable, '[data-state-primary]').textContent).toBe(
						m.gift_reserved_by_other_overlay(),
					);
					expectSoftenedFrame(framePaint(available, view), framePaint(unavailable, view));
				}
			}
		},
	);

	it.each(['card', 'list'] as const)(
		'keeps Like, More, and Cancel reservation crisp on a gift fully reserved by me in %s',
		async (view) => {
			const { host } = await renderGift(view, comparisonGift('reservedByMe'));
			expectContentVisibility(host, view, RETAINED_CONTENT_VISIBILITY);
			expect(host.querySelector('[data-testid="reserve-button"]')).not.toBeNull();
			expect(host.querySelector('button[aria-pressed]')).not.toBeNull();
			expect(host.querySelector('[data-testid="gift-more-actions"]')).not.toBeNull();
			expectControlsCrisp(host);
			expectStateCrisp(host);
		},
	);

	it.each(['card', 'list'] as const)(
		'keeps the Received toggle crisp on a received gift for the recipient in %s',
		async (view) => {
			const { host } = await renderGift(view, comparisonGift('received'), {
				role: WISHLIST_ROLES.recipient,
			});
			expectContentVisibility(host, view, RETAINED_CONTENT_VISIBILITY);
			expect(host.querySelector('[data-testid="gift-received-toggle"]')).not.toBeNull();
			expectControlsCrisp(host);
			expectStateCrisp(host);
			expectNoVeil(host);
		},
	);

	it.each(['card', 'list'] as const)(
		'keeps moderator reserver identity crisp above faded content in %s',
		async (view) => {
			const { host } = await renderGift(view, comparisonGift('reservedByOthers'), {
				role: WISHLIST_ROLES.moderator,
			});
			const identity = element(host, '[data-reserver-identity]');
			expect(identity.textContent).toContain('Babička');
			expectContentVisibility(host, view, RETAINED_CONTENT_VISIBILITY);
			expectStateCrisp(host);
			expectControlsCrisp(host);
		},
	);

	it.each(['card', 'list'] as const)(
		'keeps hidden reservations at full visibility for the recipient in %s',
		async (view) => {
			const { host } = await renderGift(view, comparisonGift('reservedByOthers'), {
				role: WISHLIST_ROLES.recipient,
			});
			expectContentVisibility(host, view, 1);
			expect(host.querySelector('[data-state-primary]')).toBeNull();
			expect(host.textContent).not.toContain('Babička');
		},
	);

	it.each(['card', 'list'] as const)(
		'restores available styles after reservation and received transitions in %s',
		async (view) => {
			const { host, screen, props } = await renderGift(view, comparisonGift('available'));
			const availablePaint = framePaint(host, view);

			for (const state of [
				'reservedByOthers',
				'available',
				'received',
				'available',
			] as const) {
				await screen.rerender({ ...props, gift: comparisonGift(state) });
				const visibility = state === 'available' ? 1 : RETAINED_CONTENT_VISIBILITY;
				expectContentVisibility(host, view, visibility);
				expectControlsCrisp(host);
				// The surface transitions box-shadow; wait for the settled paint.
				await expect
					.poll(() => framePaint(host, view).boxShadow === availablePaint.boxShadow)
					.toBe(state === 'available');
				const paint = framePaint(host, view);
				if (state === 'available') {
					expect(paint).toEqual(availablePaint);
				} else {
					expectSoftenedFrame(availablePaint, paint);
				}
			}
		},
	);

	it.each([
		{ view: 'card' as const, present: 'category', absent: 'priority' },
		{ view: 'card' as const, present: 'priority', absent: 'category' },
		{ view: 'list' as const, present: 'category', absent: 'priority' },
		{ view: 'list' as const, present: 'priority', absent: 'category' },
	])(
		'fades a lone $present badge once without rendering the $absent badge in $view',
		async ({ view, present, absent }) => {
			const gift = comparisonGift('reservedByOthers');
			const loneBadgeGift: GiftForVisitor =
				present === 'category'
					? { ...gift, priorityLabel: null }
					: { ...gift, categoryId: null, category: null };
			const { host } = await renderGift(view, loneBadgeGift);
			const badge = element(host, contentSelectors[view][present]);
			expect(effectiveOpacity(badge, host)).toBeCloseTo(RETAINED_CONTENT_VISIBILITY, 3);
			expect(getComputedStyle(badge).filter).toBe('none');
			expect(host.querySelector(contentSelectors[view][absent])).toBeNull();
		},
	);

	it.each(['card', 'list'] as const)('keeps faded source links operable in %s', async (view) => {
		const { host } = await renderGift(view, comparisonGift('reservedByOthers'));
		const link = element(host, contentSelectors[view].link);
		const rect = link.getBoundingClientRect();
		const hit = document.elementFromPoint(
			rect.left + rect.width / 2,
			rect.top + rect.height / 2,
		);
		expect(link.contains(hit)).toBe(true);
		expect(getComputedStyle(link).pointerEvents).not.toBe('none');
	});
});
