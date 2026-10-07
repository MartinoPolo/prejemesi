import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { createPixelAssertions } from '../../../../../tests/helpers/pixel-assertions.mjs';
import * as m from '$lib/paraglide/messages.js';
import type { GiftForVisitor } from '$lib/modules/gifts/types.js';
import type { ReservationForModerator } from '$lib/modules/reservations/types.js';
import type { WishlistRole } from '$lib/modules/wishlists/types.js';
import type { GiftActionPlacementSnapshot } from '$lib/components/blocks/wishlist/gift_context_invocation.js';
import {
	RESERVATION_RELEASE_CAPABILITY,
	type ReservationReleaseCapability,
} from '$lib/modules/wishlists/wishlist_capabilities.js';
import {
	MORE_ACTION_SELECTOR,
	expectRightAlignedAdjacentActions,
	settleActionPlacement,
	visibleActions,
} from './gift_action_geometry.test_fixtures.js';
import { expectContentClearsOverlayClose } from '$lib/components/base/dialog/overlay_close_geometry.test_fixtures.js';

// The images module barrel reads `$env/dynamic/public`, which the bare test document doesn't seed.
vi.mock('$env/dynamic/public', () => ({ env: {} }));

const { default: GiftDetailModalTestHost } = await import('./GiftDetailModalTestHost.svelte');

const { expectPixelsNear } = createPixelAssertions(expect);

const TALL_PHOTO_URL =
	'data:image/svg+xml,' +
	encodeURIComponent(
		'<svg xmlns="http://www.w3.org/2000/svg" width="300" height="600"><rect width="100%" height="100%" fill="#cbd5e1"/></svg>',
	);
const BROKEN_PHOTO_URL = 'data:image/png;base64,AAAA';

function makeGift(overrides: Partial<GiftForVisitor> = {}): GiftForVisitor {
	return {
		id: 'gift-viewer',
		wishlistId: 'wishlist-1',
		name: 'Sluchátka Sony WH-1000XM5',
		description: 'Černá barva, ideálně s pouzdrem.',
		descriptionAppends: [],
		editedAfterShareAt: null,
		links: [],
		price: 8990,
		priceMax: null,
		currency: 'CZK',
		imageUrl: null,
		imageKey: null,
		imageMeta: null,
		quantity: 2,
		sortOrder: 0,
		received: false,
		createdAt: new Date('2026-01-01T00:00:00Z'),
		priorityLevelId: null,
		priorityLabel: null,
		prioritySortOrder: null,
		likeCount: 12,
		reservedCount: 0,
		isFullyReserved: false,
		reserverNames: [],
		myReservationId: null,
		myReservationPurchasedAt: null,
		...overrides,
	};
}

const ownReservation = {
	reservedCount: 1,
	myReservationId: 'reservation-own',
} satisfies Partial<GiftForVisitor>;

const otherReservation: ReservationForModerator = {
	id: 'reservation-other',
	giftId: 'gift-viewer',
	quantity: 1,
	displayName: 'Petr Svoboda',
	releasable: true,
	createdAt: new Date('2026-01-02T00:00:00Z'),
};

interface ViewerOptions {
	role?: WishlistRole;
	viewportWidth?: number;
	viewportHeight?: number;
	hideReservationState?: boolean;
	releaseCapability?: ReservationReleaseCapability;
	releaseLedger?: ReservationForModerator[];
	isAuthenticated?: boolean;
	isArchived?: boolean;
	onmore?: (anchor: HTMLButtonElement, placementSnapshot: GiftActionPlacementSnapshot) => void;
}

async function renderViewer(gift: GiftForVisitor, options: ViewerOptions = {}) {
	const {
		role = 'visitor',
		viewportWidth = 1280,
		viewportHeight = 800,
		hideReservationState = role === 'recipient',
		releaseCapability,
		releaseLedger,
		isAuthenticated,
		isArchived = false,
		onmore,
	} = options;
	await page.viewport(viewportWidth, viewportHeight);
	const screen = await render(GiftDetailModalTestHost, {
		open: true,
		mode: 'edit' as const,
		wishlistId: gift.wishlistId,
		priorityLevels: [],
		readOnly: true,
		gift,
		role,
		hideReservationState,
		releaseCapability,
		releaseLedger,
		isAuthenticated,
		isArchived,
		onmore,
	});
	const dialog = page.getByRole('dialog');
	await expect.element(dialog).toBeVisible();
	const dialogElement = dialog.element() as HTMLElement;
	await Promise.allSettled(dialogElement.getAnimations().map((animation) => animation.finished));
	return { screen, dialog: dialogElement };
}

function stateList(placement: 'photo' | 'caption'): HTMLElement | null {
	return document.querySelector<HTMLElement>(
		`[data-testid="gift-state-list"][data-placement="${placement}"]`,
	);
}

function footer(): HTMLElement | null {
	return document.querySelector<HTMLElement>('[data-testid="gift-viewer-footer"]');
}

function isDisplayed(element: HTMLElement): boolean {
	return getComputedStyle(element).display !== 'none';
}

async function waitForMeasuredPhoto(expectedAspectRatio: number) {
	const photoFrame = document.querySelector<HTMLElement>(
		'[data-testid="gift-viewer-photo"] [data-testid="image-frame"]',
	)!;
	await expect
		.poll(() => {
			const rectangle = photoFrame.getBoundingClientRect();
			return Math.abs(rectangle.width / rectangle.height - expectedAspectRatio);
		})
		.toBeLessThan(0.01);
	return photoFrame;
}

describe('Gift viewer caption', () => {
	it('names the dialog with the visible title and shows every link without priority', async () => {
		const links = Array.from({ length: 10 }, (_, index) => ({
			url: `https://obchod-${index}.cz/produkt`,
		}));
		const { dialog } = await renderViewer(
			makeGift({ links, priorityLabel: 'Vysoka', priorityLevelId: 'priority-high' }),
		);

		await expect
			.element(page.getByRole('dialog', { name: 'Sluchátka Sony WH-1000XM5' }))
			.toBeVisible();
		const title = page.getByRole('heading', { level: 2, name: 'Sluchátka Sony WH-1000XM5' });
		await expect.element(title).toBeVisible();
		expect(title.element().tagName).toBe('H2');
		for (const index of links.keys()) {
			expect(dialog.textContent).toContain(`obchod-${index}.cz`);
		}
		expect(dialog.textContent).toContain('Černá barva, ideálně s pouzdrem.');
		expect(dialog.textContent).not.toContain(m.gift_priority_high());
	});

	it('shows the missing price as text', async () => {
		const { dialog } = await renderViewer(makeGift({ price: null }));

		expect(dialog.textContent).toContain(m.gift_price_not_listed());
	});
});

describe('Gift viewer state badges', () => {
	it('renders one state list per placement and shows the photo placement on desktop', async () => {
		await renderViewer(makeGift({ ...ownReservation, imageUrl: TALL_PHOTO_URL }));

		const photoStates = stateList('photo')!;
		const captionStates = stateList('caption')!;
		expect(photoStates.getAttribute('aria-label')).toBe(m.gift_state_list_label());
		expect(photoStates.querySelector('[data-state-primary]')?.textContent?.trim()).toBe(
			m.gift_reserved_by_me_overlay(),
		);
		expect(captionStates.textContent).toBe(photoStates.textContent);
		expect(isDisplayed(photoStates)).toBe(true);
		expect(isDisplayed(captionStates)).toBe(false);
	});

	it('moves the state list into the caption between links and description on mobile', async () => {
		await renderViewer(makeGift({ ...ownReservation, imageUrl: TALL_PHOTO_URL }), {
			viewportWidth: 390,
			viewportHeight: 844,
		});

		const captionStates = stateList('caption')!;
		expect(isDisplayed(stateList('photo')!)).toBe(false);
		expect(isDisplayed(captionStates)).toBe(true);
		const description = page.getByText('Černá barva, ideálně s pouzdrem.').element();
		expect(
			captionStates.compareDocumentPosition(description) & Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
	});

	it('keeps photo badges on the footer action baseline', async () => {
		await renderViewer(makeGift({ ...ownReservation, imageUrl: TALL_PHOTO_URL }));
		await waitForMeasuredPhoto(0.5);

		const photoStates = stateList('photo')!.getBoundingClientRect();
		const like = page
			.getByRole('button', {
				name: m.gift_like_add_aria({ name: 'Sluchátka Sony WH-1000XM5' }),
			})
			.element()
			.getBoundingClientRect();
		expectPixelsNear(photoStates.bottom, like.bottom, undefined, 1);
	});

	it('uses the caption placement when the photo fails to load', async () => {
		await renderViewer(makeGift({ ...ownReservation, imageUrl: BROKEN_PHOTO_URL }));

		await expect
			.poll(() => document.querySelector('[data-testid="gift-viewer-photo"]'))
			.toBe(null);
		expect(stateList('photo')).toBeNull();
		expect(isDisplayed(stateList('caption')!)).toBe(true);
	});

	it('never puts state badges in the footer', async () => {
		await renderViewer(
			makeGift({
				...ownReservation,
				imageUrl: TALL_PHOTO_URL,
				myReservationPurchasedAt: new Date('2026-09-01T00:00:00Z'),
			}),
		);

		const footerElement = footer()!;
		expect(footerElement.querySelector('[data-testid="gift-state-list"]')).toBeNull();
		expect(footerElement.querySelector('[data-state-kind]')).toBeNull();
		expect(
			footerElement.querySelector(`button[aria-label="${m.gift_mark_unbought()}"]`),
		).not.toBeNull();
	});

	it('shows the recipient no state and no footer', async () => {
		const { dialog } = await renderViewer(
			makeGift({
				...ownReservation,
				received: true,
				isFullyReserved: true,
				reserverNames: ['Petr Svoboda'],
				myReservationPurchasedAt: new Date('2026-09-01T00:00:00Z'),
			}),
			{ role: 'recipient' },
		);

		expect(stateList('photo')).toBeNull();
		expect(stateList('caption')).toBeNull();
		expect(footer()).toBeNull();
		expect(dialog.textContent).not.toContain('Petr Svoboda');
		expect(dialog.textContent).not.toContain(m.gift_bought());
	});

	it('shows the recipient preview no state and no footer', async () => {
		await renderViewer(makeGift({ ...ownReservation, received: true }), {
			role: 'moderator',
			hideReservationState: true,
		});

		expect(stateList('caption')).toBeNull();
		expect(footer()).toBeNull();
	});

	it.each([
		{ state: 'reserved by others', overrides: { reservedCount: 2, isFullyReserved: true } },
		{ state: 'received', overrides: { received: true } },
	])('never dims or overlays the photo of a gift $state', async ({ overrides }) => {
		await renderViewer(makeGift({ imageUrl: TALL_PHOTO_URL, ...overrides }));
		const photoFrame = await waitForMeasuredPhoto(0.5);

		const photoRegion = page.getByTestId('gift-viewer-photo').element();
		expect(photoRegion.querySelector('button')).toBeNull();
		expect(photoRegion.querySelector('[data-testid="gift-state-overlay"]')).toBeNull();

		for (
			let element: HTMLElement | null = photoFrame;
			element !== null;
			element = element.parentElement
		) {
			const style = getComputedStyle(element);
			expect(style.opacity).toBe('1');
			expect(style.filter).toBe('none');
		}
	});
});

describe('Gift viewer footer actions', () => {
	function visibleFooterButtons(): HTMLButtonElement[] {
		return Array.from(footer()!.querySelectorAll<HTMLButtonElement>('button')).filter(
			(button) => button.getBoundingClientRect().height > 0,
		);
	}

	function expectActionLaneGeometry(expectedHeight: number) {
		const buttons = visibleFooterButtons();
		const rectangles = buttons.map((button) => button.getBoundingClientRect());
		for (const rectangle of rectangles) {
			expectPixelsNear(rectangle.height, expectedHeight);
		}
		for (const [index, rectangle] of rectangles.slice(1).entries()) {
			expectPixelsNear(rectangle.left - rectangles[index]!.right, 8);
		}
		const footerElement = footer()!;
		const footerContentRight =
			footerElement.getBoundingClientRect().right -
			parseFloat(getComputedStyle(footerElement).paddingRight);
		expectPixelsNear(rectangles.at(-1)!.right, footerContentRight);
	}

	it.each([
		{ viewer: 'visitor', releaseCapability: RESERVATION_RELEASE_CAPABILITY.none },
		{ viewer: 'administrator', releaseCapability: RESERVATION_RELEASE_CAPABILITY.any },
	])(
		'keeps right-aligned equal-height actions with an eight-pixel gap for a $viewer',
		async ({ releaseCapability }) => {
			const canRelease = releaseCapability === RESERVATION_RELEASE_CAPABILITY.any;
			await renderViewer(makeGift(), {
				releaseCapability,
				releaseLedger: canRelease ? [otherReservation] : [],
			});
			const giftName = { name: 'Sluchátka Sony WH-1000XM5' };
			const expectedLabels = [
				m.gift_like_add_aria(giftName),
				m.reserve_button_reserve_aria(giftName),
				...(canRelease ? [m.reserve_release_button_aria(giftName)] : []),
			];

			for (const [viewportWidth, expectedHeight] of [
				[390, 40],
				[800, 32],
			] as const) {
				await page.viewport(viewportWidth, 800);
				expect(
					visibleFooterButtons().map((button) => button.getAttribute('aria-label')),
				).toEqual(expectedLabels);
				expectActionLaneGeometry(expectedHeight);
			}
		},
	);

	it('orders Like, Koupeno and Zrušit for a signed-in reserver', async () => {
		await renderViewer(makeGift(ownReservation));

		const labels = visibleFooterButtons().map(
			(button) => button.getAttribute('aria-label') ?? button.textContent?.trim(),
		);
		expect(labels).toEqual([
			m.gift_like_add_aria({ name: 'Sluchátka Sony WH-1000XM5' }),
			m.gift_mark_bought(),
			m.reserve_button_cancel_aria({ name: 'Sluchátka Sony WH-1000XM5' }),
		]);
	});

	it('omits Koupeno for anonymous reservers', async () => {
		const { dialog } = await renderViewer(makeGift(ownReservation), {
			isAuthenticated: false,
		});

		await expect
			.element(
				page.getByRole('button', {
					name: m.reserve_button_cancel_aria({ name: 'Sluchátka Sony WH-1000XM5' }),
				}),
			)
			.toBeVisible();
		expect(dialog.textContent).not.toContain(m.gift_bought());
	});

	it('keeps only Like when others reserved every piece', async () => {
		await renderViewer(makeGift({ reservedCount: 2, isFullyReserved: true }));

		expect(visibleFooterButtons().map((button) => button.getAttribute('aria-label'))).toEqual([
			m.gift_like_add_aria({ name: 'Sluchátka Sony WH-1000XM5' }),
		]);
	});
});

describe('Gift viewer footer overflow', () => {
	const giftName = { name: 'Sluchátka Sony WH-1000XM5' };
	// An administrator who holds a bought reservation while someone else holds the other piece.
	const crowdedGift = makeGift({
		...ownReservation,
		reservedCount: 2,
		isFullyReserved: true,
		myReservationPurchasedAt: new Date('2026-01-03T00:00:00Z'),
	});
	const crowdedOptions = {
		releaseCapability: RESERVATION_RELEASE_CAPABILITY.any,
		releaseLedger: [otherReservation],
	};

	function footerContentEdges() {
		const footerElement = footer()!;
		const rectangle = footerElement.getBoundingClientRect();
		const style = getComputedStyle(footerElement);
		return {
			left: rectangle.left + parseFloat(style.paddingLeft),
			right: rectangle.right - parseFloat(style.paddingRight),
		};
	}

	function inlineLabels(): Array<string | null> {
		return visibleActions(footer()!).map(
			(action) => action.getAttribute('aria-label') ?? action.textContent?.trim() ?? null,
		);
	}

	function expectOneUnwrappedLane() {
		const actions = visibleActions(footer()!);
		const edges = footerContentEdges();
		expectRightAlignedAdjacentActions(footer()!, actions, edges.right);
		expect(actions[0]!.getBoundingClientRect().left).toBeGreaterThanOrEqual(edges.left - 0.5);
	}

	it('moves secondary actions into More on a phone and restores them when space returns', async () => {
		const onmore = vi.fn();
		await renderViewer(crowdedGift, {
			...crowdedOptions,
			viewportWidth: 390,
			viewportHeight: 844,
			onmore,
		});
		await settleActionPlacement();

		const labels = inlineLabels();
		expect(labels[0]).toBe(m.gift_like_add_aria(giftName));
		expect(labels).toContain(m.reserve_button_cancel_aria(giftName));
		expect(labels.at(-1)).toBe(m.gift_more_actions());
		// Koupeno leaves the lane first, so it is gone whenever anything overflows.
		expect(labels).not.toContain(m.gift_mark_unbought());
		expectOneUnwrappedLane();

		const more = visibleActions(footer()!).find((action) =>
			action.matches(MORE_ACTION_SELECTOR),
		)!;
		more.click();
		expect(onmore).toHaveBeenCalledTimes(1);
		const snapshot: GiftActionPlacementSnapshot = onmore.mock.calls[0]![1];
		expect(snapshot.visibleDirectActions).toContain('cancel-reservation');
		expect(snapshot.visibleDirectActions).not.toContain('purchased');
		expect(snapshot.visibleDirectActions.includes('release-reservation')).toBe(
			labels.includes(m.reserve_release_button_aria(giftName)),
		);

		await page.viewport(800, 800);
		await settleActionPlacement();
		await expect
			.poll(inlineLabels)
			.toEqual([
				m.gift_like_add_aria(giftName),
				m.gift_mark_unbought(),
				m.reserve_button_cancel_aria(giftName),
				m.reserve_release_button_aria(giftName),
			]);
		expectOneUnwrappedLane();
	});

	it.each([
		{
			viewer: 'visitor',
			gift: makeGift(),
			expectedLabels: () => [
				m.gift_like_add_aria(giftName),
				m.reserve_button_reserve_aria(giftName),
			],
		},
		{
			viewer: 'signed-in reserver',
			gift: makeGift(ownReservation),
			expectedLabels: () => [
				m.gift_like_add_aria(giftName),
				m.gift_mark_bought(),
				m.reserve_button_cancel_aria(giftName),
			],
		},
	])(
		'keeps every $viewer action inline on a phone when the lane fits',
		async ({ gift, expectedLabels }) => {
			await renderViewer(gift, { viewportWidth: 390, viewportHeight: 844, onmore: vi.fn() });
			await settleActionPlacement();

			expect(inlineLabels()).toEqual(expectedLabels());
			expectOneUnwrappedLane();
		},
	);
});

describe('Gift viewer layout', () => {
	it('sizes the desktop photo column to a tall photo and centers the dialog', async () => {
		const { dialog } = await renderViewer(makeGift({ imageUrl: TALL_PHOTO_URL }));
		const photoFrame = await waitForMeasuredPhoto(0.5);

		const photoRectangle = photoFrame.getBoundingClientRect();
		const captionRectangle = page
			.getByTestId('gift-viewer-caption')
			.element()
			.getBoundingClientRect();
		expect(photoRectangle.right).toBeLessThanOrEqual(captionRectangle.left);
		const dialogRectangle = dialog.getBoundingClientRect();
		expectPixelsNear(
			dialogRectangle.left,
			window.innerWidth - dialogRectangle.right,
			undefined,
			1,
		);
		expect(dialogRectangle.height).toBeLessThanOrEqual(window.innerHeight * 0.9 + 0.5);
	});

	it('renders the text-only viewer narrower than the photo layout without collapsing it', async () => {
		const { dialog: photoDialog, screen } = await renderViewer(
			makeGift({ imageUrl: TALL_PHOTO_URL }),
		);
		await waitForMeasuredPhoto(0.5);
		const photoLayoutWidth = photoDialog.getBoundingClientRect().width;
		screen.unmount();

		const { dialog } = await renderViewer(makeGift());

		expect(document.querySelector('[data-testid="gift-viewer-photo"]')).toBeNull();
		const textOnlyWidth = dialog.getBoundingClientRect().width;
		expect(textOnlyWidth).toBeLessThan(photoLayoutWidth);
		expect(textOnlyWidth).toBeGreaterThan(window.innerWidth / 3);
	});

	it.each([700, 640])(
		'keeps the photo column usable without horizontal overflow at %ipx',
		async (viewportWidth) => {
			const { dialog } = await renderViewer(makeGift({ imageUrl: TALL_PHOTO_URL }), {
				viewportWidth,
			});
			await waitForMeasuredPhoto(0.5);

			const dialogRectangle = dialog.getBoundingClientRect();
			const photoRectangle = page
				.getByTestId('gift-viewer-photo')
				.element()
				.getBoundingClientRect();
			const captionRectangle = page
				.getByTestId('gift-viewer-caption')
				.element()
				.getBoundingClientRect();
			expect(dialogRectangle.left).toBeGreaterThanOrEqual(-0.5);
			expect(dialogRectangle.right).toBeLessThanOrEqual(viewportWidth + 0.5);
			expect(captionRectangle.right).toBeLessThanOrEqual(dialogRectangle.right + 0.5);
			expect(captionRectangle.width).toBeGreaterThanOrEqual(339.5);
			if (viewportWidth === 700) {
				expect(photoRectangle.width).toBeGreaterThanOrEqual(279.5);
			}
		},
	);

	it('opens as a full-screen sheet with the footer pinned to the bottom on mobile', async () => {
		const { dialog } = await renderViewer(makeGift({ imageUrl: TALL_PHOTO_URL }), {
			viewportWidth: 390,
			viewportHeight: 844,
		});

		const dialogRectangle = dialog.getBoundingClientRect();
		expectPixelsNear(dialogRectangle.left, 0);
		expectPixelsNear(dialogRectangle.top, 0);
		expectPixelsNear(dialogRectangle.width, 390);
		expectPixelsNear(dialogRectangle.height, 844);
		expect(getComputedStyle(dialog).borderTopLeftRadius).toBe('0px');
		expectPixelsNear(footer()!.getBoundingClientRect().bottom, 844);
	});

	it.each(
		[
			{
				layout: 'desktop with a photo',
				viewportWidth: 1280,
				viewportHeight: 800,
				photo: true,
			},
			{
				layout: 'desktop without a photo',
				viewportWidth: 1280,
				viewportHeight: 800,
				photo: false,
			},
			{
				layout: 'mobile without a photo',
				viewportWidth: 390,
				viewportHeight: 844,
				photo: false,
			},
		].flatMap((scenario) =>
			(['soft', 'ink', 'black'] as const).map((depth) => ({ ...scenario, depth })),
		),
	)(
		'keeps the title row clear of the close button on $layout at $depth depth',
		async ({ viewportWidth, viewportHeight, photo, depth }) => {
			document.documentElement.dataset.depth = depth;
			try {
				await renderViewer(makeGift(photo ? { imageUrl: TALL_PHOTO_URL } : {}), {
					viewportWidth,
					viewportHeight,
				});
				const title = page
					.getByRole('heading', { level: 2, name: 'Sluchátka Sony WH-1000XM5' })
					.element() as HTMLElement;
				const close = page
					.getByRole('button', { name: m.close() })
					.element() as HTMLElement;
				expect(close.getBoundingClientRect().top).toBeLessThan(
					title.getBoundingClientRect().bottom,
				);
				expectContentClearsOverlayClose(title, close);
			} finally {
				delete document.documentElement.dataset.depth;
			}
		},
	);
});

describe('Gift viewer caption details', () => {
	it('spaces both separators in the price line when a reserved count shows', async () => {
		await renderViewer(makeGift({ quantity: 3, reservedCount: 1 }));

		const pieceCount = page.getByTestId('gift-piece-count').element();
		const priceLineText = (pieceCount.parentElement!.textContent ?? '').replace(/\s+/g, ' ');
		expect(priceLineText.match(/·/g)).toHaveLength(2);
		expect(priceLineText).not.toMatch(/\S·|·\S/);
	});

	it('exposes the state badges as a list', async () => {
		await renderViewer(makeGift({ ...ownReservation, received: true }));

		const captionStates = stateList('caption')!;
		expect(captionStates.getAttribute('role')).toBe('list');
		expect(captionStates.querySelectorAll('li').length).toBeGreaterThanOrEqual(2);
	});
});

describe('Gift viewer footer insets', () => {
	it.each([
		{ viewportWidth: 1280, viewportHeight: 800, administrator: false },
		{ viewportWidth: 1280, viewportHeight: 800, administrator: true },
		{ viewportWidth: 390, viewportHeight: 844, administrator: false },
		{ viewportWidth: 390, viewportHeight: 844, administrator: true },
	])(
		'keeps equal end and bottom insets from the dialog edge at $viewportWidth px (administrator: $administrator)',
		async ({ viewportWidth, viewportHeight, administrator }) => {
			const { dialog } = await renderViewer(makeGift(), {
				viewportWidth,
				viewportHeight,
				releaseCapability: administrator
					? RESERVATION_RELEASE_CAPABILITY.any
					: RESERVATION_RELEASE_CAPABILITY.none,
				releaseLedger: administrator ? [otherReservation] : [],
			});
			await settleActionPlacement();

			const dialogRectangle = dialog.getBoundingClientRect();
			const actions = visibleActions(footer()!);
			const lastAction = actions.at(-1)!.getBoundingClientRect();
			const rightInset = dialogRectangle.right - lastAction.right;
			const bottomInset = dialogRectangle.bottom - lastAction.bottom;
			if (administrator) {
				expect(actions.at(-1)!.getAttribute('aria-label')).toBe(
					m.reserve_release_button_aria({ name: 'Sluchátka Sony WH-1000XM5' }),
				);
			}
			expectPixelsNear(rightInset, bottomInset, undefined, 1);
		},
	);
});

describe('Gift viewer actions by role', () => {
	const giftName = { name: 'Sluchátka Sony WH-1000XM5' };

	function footerLabels(): Array<string | null> {
		return visibleActions(footer()!).map(
			(action) => action.getAttribute('aria-label') ?? action.textContent?.trim() ?? null,
		);
	}

	it('offers a visitor no Reserve on an archived list but keeps Like', async () => {
		await renderViewer(makeGift(), { isArchived: true });

		expect(footerLabels()).toEqual([m.gift_like_add_aria(giftName)]);
	});

	it('offers a reservation owner on an archived list only Zrušit beside Like', async () => {
		await renderViewer(makeGift(ownReservation), { isArchived: true });

		expect(footerLabels()).toEqual([
			m.gift_like_add_aria(giftName),
			m.reserve_button_cancel_aria(giftName),
		]);
	});

	it('offers an administrator Like and Uvolnit on a gift others reserved', async () => {
		await renderViewer(makeGift({ reservedCount: 2, isFullyReserved: true }), {
			releaseCapability: RESERVATION_RELEASE_CAPABILITY.any,
			releaseLedger: [otherReservation],
		});

		expect(footerLabels()).toEqual([
			m.gift_like_add_aria(giftName),
			m.reserve_release_button_aria(giftName),
		]);
	});

	it('keeps a lone Like on the same end and bottom insets as any other action', async () => {
		const { dialog } = await renderViewer(
			makeGift({ reservedCount: 2, isFullyReserved: true }),
			{
				onmore: vi.fn(),
			},
		);
		await settleActionPlacement();

		const actions = visibleActions(footer()!);
		expect(actions).toHaveLength(1);
		const like = actions[0]!.getBoundingClientRect();
		const dialogRectangle = dialog.getBoundingClientRect();
		expectPixelsNear(
			dialogRectangle.right - like.right,
			dialogRectangle.bottom - like.bottom,
			undefined,
			1,
		);
	});
});

const NINE_BY_SIXTEEN_PHOTO_URL =
	'data:image/svg+xml,' +
	encodeURIComponent(
		'<svg xmlns="http://www.w3.org/2000/svg" width="270" height="480"><rect width="100%" height="100%" fill="#cbd5e1"/></svg>',
	);
const LANDSCAPE_PHOTO_URL =
	'data:image/svg+xml,' +
	encodeURIComponent(
		'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="100%" height="100%" fill="#cbd5e1"/></svg>',
	);
const LONG_DESCRIPTION = Array.from(
	{ length: 40 },
	(_, index) => `Odstavec ${index + 1}: černá barva, ideálně s pouzdrem a náhradními polštářky.`,
).join('\n');

function photoRegion(): HTMLElement {
	return page.getByTestId('gift-viewer-photo').element() as HTMLElement;
}

async function loadedPhotoImage(): Promise<HTMLImageElement> {
	const image = photoRegion().querySelector('img')!;
	await expect.poll(() => image.complete && image.naturalWidth > 0).toBe(true);
	return image;
}

/** The painted photo inside its `object-fit: contain` box, excluding any letterbox. */
function renderedPhotoSize(image: HTMLImageElement) {
	const box = image.getBoundingClientRect();
	const naturalAspectRatio = image.naturalWidth / image.naturalHeight;
	const width = Math.min(box.width, box.height * naturalAspectRatio);
	return { width, height: width / naturalAspectRatio };
}

function nearestScrollableAncestor(element: HTMLElement): HTMLElement | null {
	for (
		let ancestor = element.parentElement;
		ancestor !== null;
		ancestor = ancestor.parentElement
	) {
		const { overflowY } = getComputedStyle(ancestor);
		if (
			(overflowY === 'auto' || overflowY === 'scroll') &&
			ancestor.scrollHeight > ancestor.clientHeight
		) {
			return ancestor;
		}
	}
	return null;
}

function resolvedLength(container: HTMLElement, length: string): number {
	const probe = document.createElement('div');
	probe.style.position = 'absolute';
	probe.style.width = length;
	container.append(probe);
	const width = probe.getBoundingClientRect().width;
	probe.remove();
	return width;
}

function expectSingleLineLabels(list: HTMLElement) {
	for (const badge of list.querySelectorAll('li')) {
		const labelRange = document.createRange();
		labelRange.selectNodeContents(badge);
		expect(labelRange.getClientRects().length, badge.textContent ?? '').toBe(1);
	}
}

function badgeRowCount(list: HTMLElement): number {
	const tops = Array.from(list.querySelectorAll('li')).map((badge) =>
		Math.round(badge.getBoundingClientRect().top),
	);
	return new Set(tops).size;
}

async function settleLayout() {
	await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

describe('Gift viewer state badge wrapping', () => {
	// A správce sees a received gift with free pieces and the named reserver as three entries.
	const severalStatesGift = makeGift({
		received: true,
		quantity: 3,
		reservedCount: 1,
		reserverNames: ['Bohumila Nováková-Svobodová'],
	});

	it('keeps several photo badges on one row when the photo column has room', async () => {
		await renderViewer(
			{ ...severalStatesGift, imageUrl: LANDSCAPE_PHOTO_URL },
			{ role: 'moderator' },
		);
		await waitForMeasuredPhoto(4 / 3);
		await settleLayout();

		const photoStates = stateList('photo')!;
		expect(photoStates.querySelectorAll('li').length).toBeGreaterThanOrEqual(2);
		expect(badgeRowCount(photoStates)).toBe(1);
		expectSingleLineLabels(photoStates);
	});

	it('wraps photo badges in a narrow column on the action baseline and content inset', async () => {
		await renderViewer(
			{ ...severalStatesGift, imageUrl: TALL_PHOTO_URL },
			{ role: 'moderator', viewportWidth: 700 },
		);
		await waitForMeasuredPhoto(0.5);
		await settleLayout();

		const photoStates = stateList('photo')!;
		expect(isDisplayed(photoStates)).toBe(true);
		expect(badgeRowCount(photoStates)).toBeGreaterThanOrEqual(2);
		expectSingleLineLabels(photoStates);

		const listRectangle = photoStates.getBoundingClientRect();
		const lastAction = visibleActions(footer()!).at(-1)!.getBoundingClientRect();
		expectPixelsNear(listRectangle.bottom, lastAction.bottom, undefined, 1);

		const region = photoRegion();
		const regionRectangle = region.getBoundingClientRect();
		const contentInset = resolvedLength(region, 'var(--gift-content-inset)');
		expect(contentInset).toBeGreaterThan(0);
		expectPixelsNear(listRectangle.left, regionRectangle.left + contentInset, undefined, 1);
		expect(listRectangle.right).toBeLessThanOrEqual(regionRectangle.right + 0.5);
	});

	it('wraps the caption badges on a phone with single-line labels', async () => {
		await renderViewer(
			{ ...severalStatesGift, imageUrl: TALL_PHOTO_URL },
			{ role: 'moderator', viewportWidth: 390, viewportHeight: 844 },
		);
		await settleLayout();

		const captionStates = stateList('caption')!;
		expect(isDisplayed(captionStates)).toBe(true);
		expect(badgeRowCount(captionStates)).toBeGreaterThanOrEqual(2);
		expectSingleLineLabels(captionStates);
		expect(captionStates.getBoundingClientRect().right).toBeLessThanOrEqual(390.5);
	});
});

describe('Gift viewer mobile sheet', () => {
	it('caps a tall photo at about 55 % of the viewport height at full width', async () => {
		await renderViewer(makeGift({ imageUrl: TALL_PHOTO_URL }), {
			viewportWidth: 390,
			viewportHeight: 844,
		});
		await loadedPhotoImage();
		await settleLayout();

		// The photo frame, not the region whose bottom border divides it from the caption.
		const photo = photoRegion()
			.querySelector('[data-testid="image-frame"]')!
			.getBoundingClientRect();
		expectPixelsNear(photo.left, 0);
		expectPixelsNear(photo.width, 390, undefined, 1);
		expect(photo.height).toBeLessThanOrEqual(0.55 * 844 + 1);
	});

	it('scrolls photo and caption together above a pinned footer', async () => {
		const links = Array.from({ length: 10 }, (_, index) => ({
			url: `https://obchod-${index}.cz/produkt`,
		}));
		await renderViewer(
			makeGift({ imageUrl: TALL_PHOTO_URL, description: LONG_DESCRIPTION, links }),
			{ viewportWidth: 390, viewportHeight: 844 },
		);
		await loadedPhotoImage();
		await settleLayout();

		const region = photoRegion();
		const caption = page.getByTestId('gift-viewer-caption').element() as HTMLElement;
		const scroller = nearestScrollableAncestor(region);
		expect(scroller).not.toBeNull();
		expect(nearestScrollableAncestor(caption)).toBe(scroller);
		expect(['auto', 'scroll']).not.toContain(getComputedStyle(caption).overflowY);
		expect(caption.scrollHeight).toBeLessThanOrEqual(caption.clientHeight + 1);
		expectPixelsNear(footer()!.getBoundingClientRect().bottom, 844, undefined, 1);

		const photoTopBefore = region.getBoundingClientRect().top;
		const captionTopBefore = caption.getBoundingClientRect().top;
		scroller!.scrollTop = 300;
		await settleLayout();

		const photoScrolledBy = photoTopBefore - region.getBoundingClientRect().top;
		expect(photoScrolledBy).toBeGreaterThan(0);
		expectPixelsNear(
			captionTopBefore - caption.getBoundingClientRect().top,
			photoScrolledBy,
			undefined,
			1,
		);
		expectPixelsNear(footer()!.getBoundingClientRect().bottom, 844, undefined, 1);
	});
});

describe('Gift viewer caption order', () => {
	it('stacks title, price, links, states, description, appends and the edited line on a phone', async () => {
		const { dialog } = await renderViewer(
			makeGift({
				quantity: 3,
				reservedCount: 1,
				links: [{ url: 'https://obchod.cz/sluchatka' }],
				descriptionAppends: [
					{ text: 'Doplnění: stačí i starší model.', addedAt: '2026-10-02T09:00:00Z' },
				],
				editedAfterShareAt: new Date('2026-10-03T10:00:00Z'),
				categoryId: 'category-electronics',
				category: {
					id: 'category-electronics',
					presetKey: null,
					customLabel: 'Elektronika pro test',
					color: '#2563eb',
					sortOrder: 0,
				},
			}),
			{ viewportWidth: 390, viewportHeight: 844 },
		);

		const title = page
			.getByRole('heading', { level: 2, name: 'Sluchátka Sony WH-1000XM5' })
			.element();
		const priceLine = page.getByTestId('gift-piece-count').element().parentElement!;
		expect(priceLine.textContent).toContain('3');
		expect(priceLine.textContent).toContain(m.gift_reserved_count({ count: 1 }));
		const link = dialog.querySelector('a[href*="obchod.cz"]')!;
		const states = stateList('caption')!;
		expect(isDisplayed(states)).toBe(true);
		const description = page.getByText('Černá barva, ideálně s pouzdrem.').element();
		const append = page.getByText('Doplnění: stačí i starší model.').element();
		const editedLinePrefix = m
			.gift_edited_after_share_line({ date: '{date}' })
			.split('{date}')[0]!;
		const editedLine = Array.from(dialog.querySelectorAll('p')).find((paragraph) =>
			paragraph.textContent?.startsWith(editedLinePrefix),
		)!;
		expect(editedLine).toBeDefined();

		const orderedBlocks = [title, priceLine, link, states, description, append, editedLine];
		for (const [index, block] of orderedBlocks.slice(1).entries()) {
			const previous = orderedBlocks[index]!;
			expect(
				previous.compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING,
			).toBeTruthy();
			expect(block.getBoundingClientRect().top).toBeGreaterThanOrEqual(
				previous.getBoundingClientRect().bottom - 0.5,
			);
		}
		expect(dialog.textContent).not.toContain('Elektronika pro test');
	});
});

describe('Gift viewer photo column', () => {
	it('fits the column to a 9:16 photo and letterboxes it only vertically under a long caption', async () => {
		const { screen } = await renderViewer(makeGift({ imageUrl: NINE_BY_SIXTEEN_PHOTO_URL }), {
			viewportHeight: 1000,
		});
		await waitForMeasuredPhoto(9 / 16);
		const shortCaptionPhoto = renderedPhotoSize(await loadedPhotoImage());
		expectPixelsNear(photoRegion().clientWidth, shortCaptionPhoto.width, undefined, 1);
		screen.unmount();

		await renderViewer(
			makeGift({ imageUrl: NINE_BY_SIXTEEN_PHOTO_URL, description: LONG_DESCRIPTION }),
			{ viewportHeight: 1000 },
		);
		const image = await loadedPhotoImage();
		await expect
			.poll(() => Math.abs(renderedPhotoSize(image).width - shortCaptionPhoto.width))
			.toBeLessThanOrEqual(1);
		await settleLayout();

		const longCaptionPhoto = renderedPhotoSize(image);
		const region = photoRegion();
		expectPixelsNear(region.clientWidth, longCaptionPhoto.width, undefined, 1);
		expectPixelsNear(longCaptionPhoto.height, shortCaptionPhoto.height, undefined, 1);
		expect(region.clientHeight).toBeGreaterThan(longCaptionPhoto.height + 1);
	});
});
