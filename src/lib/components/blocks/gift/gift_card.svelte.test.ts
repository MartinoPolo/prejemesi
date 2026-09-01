// Layout-invariant suite (issue #211): measures real computed geometry, so the compiled
// Tailwind utilities must be present (mirrors gift_detail_form.svelte.test.ts).
import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GiftForVisitor } from '$lib/modules/gifts/types.js';
import { WISHLIST_ROLES, type WishlistRole } from '$lib/modules/wishlists/types.js';
import { IMAGE_FIT_MODES, type ImageMetadata } from '$lib/modules/images/index.js';

// GiftImage transitively imports the images module barrel, which reads `$env/dynamic/public`.
// vitest-browser-svelte mounts without SvelteKit's page bootstrap, so the virtual module
// throws unless stubbed (same workaround as gift_detail_form.svelte.test.ts).
vi.mock('$env/dynamic/public', () => ({ env: {} }));

const { default: GiftCardTestHost } = await import('./GiftCardTestHost.svelte');

// Realistic long multi-word Czech name (issue #211 REQ-2 fixture) – long enough to stress
// the footer/name rows in a way that mirrors real content. (An unbroken 90-char run is
// also safe here: `name`'s `line-clamp-2` implies `overflow: hidden`, which per the CSS
// Sizing spec zeroes the grid item's automatic minimum size on that axis, so it can't drag
// the card wider either — see GiftCard.stories.svelte's hostile-name fixture.)
const REALISTIC_LONG_NAME =
	'Bezdrátová herní myš s RGB podsvícením a vyměnitelnými tlačítky pro praváky i leváky';
const IMAGE_URL =
	'data:image/svg+xml,' +
	encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="64"/>');

function imageMeta(bgColor: string | null): ImageMetadata {
	return {
		fitMode: IMAGE_FIT_MODES.containPadded,
		cropRect: null,
		focal: { x: 50, y: 50 },
		zoom: 1,
		bgColor,
	};
}

type CssRgb = readonly [red: number, green: number, blue: number];

function parseCssRgb(value: string): CssRgb {
	const match = value.match(
		/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*[\d.]+)?\s*\)$/,
	);
	if (!match) {
		throw new Error(`Expected a computed CSS rgb color, received: ${value}`);
	}
	return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function linearizeSrgbChannel(channel: number): number {
	const normalizedChannel = channel / 255;
	return normalizedChannel <= 0.04045
		? normalizedChannel / 12.92
		: ((normalizedChannel + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance([red, green, blue]: CssRgb): number {
	return (
		0.2126 * linearizeSrgbChannel(red) +
		0.7152 * linearizeSrgbChannel(green) +
		0.0722 * linearizeSrgbChannel(blue)
	);
}

function contrastRatio(firstColor: CssRgb, secondColor: CssRgb): number {
	const lighterLuminance = Math.max(
		relativeLuminance(firstColor),
		relativeLuminance(secondColor),
	);
	const darkerLuminance = Math.min(relativeLuminance(firstColor), relativeLuminance(secondColor));
	return (lighterLuminance + 0.05) / (darkerLuminance + 0.05);
}

function makeVisitorGift(overrides: Partial<GiftForVisitor> = {}): GiftForVisitor {
	return {
		id: 'gift-1',
		wishlistId: 'wishlist-1',
		name: REALISTIC_LONG_NAME,
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
		isFullyReserved: false,
		reserverNames: [],
		// Non-null myReservationId puts the visitor in the "reserved by me" state (#211
		// REQ-1/2): both PurchasedToggle ("mark as bought") and ReserveButton ("cancel
		// reservation") render together – the exact case that overflowed.
		myReservationId: 'reservation-1',
		myReservationPurchasedAt: null,
		...overrides,
	};
}

/** Renders `GiftCardTestHost` inside a fixed-width host that mirrors the real
 *  `WishlistGiftCardGrid` column (`minmax(280px, 1fr)`), so the card sits in a
 *  constrained track the same way it does on the wishlist page. */
const fixedHosts = new Set<HTMLElement>();

async function renderCardInGridColumn(
	gift: GiftForVisitor,
	role: WishlistRole = WISHLIST_ROLES.visitor,
	theme: { palette: string; dark: boolean } = { palette: 'sky', dark: false },
) {
	const host = document.createElement('div');
	host.style.display = 'grid';
	host.style.gridTemplateColumns = 'repeat(auto-fill, minmax(280px, 1fr))';
	host.style.width = '280px';
	host.dataset.palette = theme.palette;
	host.classList.toggle('dark', theme.dark);
	document.body.appendChild(host);
	fixedHosts.add(host);

	await render(GiftCardTestHost, { gift, role, isArchived: false }, { baseElement: host });

	return host;
}

afterEach(() => {
	for (const host of fixedHosts) {
		host.remove();
	}
	fixedHosts.clear();
});

describe('GiftCard category badge (issue #265)', () => {
	it.each([
		{
			color: '#000000',
			expectedBackground: 'rgb(0, 0, 0)',
			expectedForeground: 'rgb(255, 255, 255)',
			palette: 'sky',
			dark: false,
		},
		{
			color: '#FFFFFF',
			expectedBackground: 'rgb(255, 255, 255)',
			expectedForeground: 'rgb(0, 0, 0)',
			palette: 'grape',
			dark: true,
		},
		{
			color: '#777777',
			expectedBackground: 'rgb(119, 119, 119)',
			expectedForeground: 'rgb(0, 0, 0)',
			palette: 'honey',
			dark: false,
		},
	])(
		'keeps $color readable in the $palette palette (dark: $dark)',
		async ({ color, expectedBackground, expectedForeground, palette, dark }) => {
			const label = 'Velmi dlouhá kategorie sportovního vybavení pro celou rodinu';
			const host = await renderCardInGridColumn(
				makeVisitorGift({
					categoryId: 'category-sport',
					category: {
						id: 'category-sport',
						presetKey: null,
						customLabel: label,
						color,
						sortOrder: 0,
					},
					isFullyReserved: true,
					received: true,
				}),
				WISHLIST_ROLES.moderator,
				{ palette, dark },
			);

			const badge = host.querySelector('[data-testid="gift-category-badge"]') as HTMLElement;
			const imageFrame = host.querySelector(
				'[data-testid="gift-card-image-frame"]',
			) as HTMLElement;
			expect(badge).toBeTruthy();
			expect(imageFrame).toBeTruthy();
			expect(host.getBoundingClientRect().width).toBeCloseTo(280, 1);
			expect(badge.title).toBe(label);
			expect(badge.className).toContain('truncate');
			const style = getComputedStyle(badge);
			expect(style.backgroundColor).toBe(expectedBackground);
			expect(style.color).toBe(expectedForeground);
			expect(
				contrastRatio(parseCssRgb(style.backgroundColor), parseCssRgb(style.color)),
			).toBeGreaterThanOrEqual(4.5);
			expect(style.rotate).not.toBe('none');
			expect(Number.parseFloat(style.rotate)).toBeLessThan(0);

			const badgeRect = badge.getBoundingClientRect();
			const imageFrameRect = imageFrame.getBoundingClientRect();
			expect(imageFrameRect.width / imageFrameRect.height).toBeCloseTo(4 / 3, 2);
			const editRect = (
				host.querySelector('[data-testid="gift-card-edit-icon"]') as HTMLElement
			).getBoundingClientRect();
			const reservedRect = (
				host.querySelector('[data-testid="gift-reserved-sticker"]') as HTMLElement
			).getBoundingClientRect();
			const receivedRect = (
				host.querySelector('[data-testid="gift-received-sticker"]') as HTMLElement
			).getBoundingClientRect();
			const overlaps = (a: DOMRect, b: DOMRect) =>
				a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
			expect(badgeRect.left).toBeGreaterThanOrEqual(imageFrameRect.left);
			expect(badgeRect.top).toBeGreaterThanOrEqual(imageFrameRect.top);
			expect(badgeRect.right).toBeLessThanOrEqual(imageFrameRect.right);
			expect(badgeRect.bottom).toBeLessThanOrEqual(imageFrameRect.bottom);
			expect(badgeRect.left + badgeRect.width / 2).toBeLessThan(
				imageFrameRect.left + imageFrameRect.width / 2,
			);
			expect(badgeRect.top + badgeRect.height / 2).toBeLessThan(
				imageFrameRect.top + imageFrameRect.height / 2,
			);
			expect(overlaps(badgeRect, editRect)).toBe(false);
			expect(overlaps(badgeRect, reservedRect)).toBe(false);
			expect(overlaps(badgeRect, receivedRect)).toBe(false);
		},
	);

	it('renders no category badge while keeping the unchanged image frame for an uncategorized gift', async () => {
		const host = await renderCardInGridColumn(makeVisitorGift());
		expect(host.querySelector('[data-testid="gift-category-badge"]')).toBeNull();
		expect(
			host.querySelector(
				'[data-testid="gift-card-image-frame"] > [data-testid="image-frame"]',
			),
		).toBeTruthy();
	});
});

describe('GiftCard image background fill (issue #252)', () => {
	it('paints the visible outer card frame with explicit black and removes the pattern', async () => {
		const host = await renderCardInGridColumn(
			makeVisitorGift({ imageUrl: IMAGE_URL, imageMeta: imageMeta('#000000') }),
		);

		const cardFrame = host.querySelector(
			'[data-testid="gift-card-image-frame"]',
		) as HTMLElement;
		const imageFrame = cardFrame.querySelector('[data-testid="image-frame"]') as HTMLElement;

		expect(cardFrame).toBeTruthy();
		expect(imageFrame).toBeTruthy();
		expect(getComputedStyle(cardFrame).backgroundColor).toBe('rgb(0, 0, 0)');
		expect(getComputedStyle(imageFrame).backgroundColor).toBe('rgb(0, 0, 0)');
		expect(cardFrame.querySelector('[data-testid="gift-card-image-pattern"]')).toBeNull();
	});

	it.each([null, 'transparent'])('keeps the pattern for default %s fill', async (bgColor) => {
		const host = await renderCardInGridColumn(
			makeVisitorGift({ imageUrl: IMAGE_URL, imageMeta: imageMeta(bgColor) }),
		);

		const cardFrame = host.querySelector(
			'[data-testid="gift-card-image-frame"]',
		) as HTMLElement;
		expect(cardFrame).toBeTruthy();
		expect(cardFrame.querySelector('[data-testid="gift-card-image-pattern"]')).toBeTruthy();
	});
});

describe('GiftCard actions (issue #255)', () => {
	it('does not host reservation release even when the context permits it', async () => {
		await render(GiftCardTestHost, {
			gift: makeVisitorGift({ myReservationId: null, isFullyReserved: true }),
			role: WISHLIST_ROLES.moderator,
			isArchived: false,
			releaseCapability: 'any',
			reservations: [
				{
					id: 'reservation-other',
					giftId: 'gift-1',
					quantity: 1,
					displayName: 'Petr',
					releasable: true,
					createdAt: new Date('2026-01-02'),
				},
			],
		});

		expect(document.querySelector('[data-testid="release-reservation-button"]')).toBeNull();
	});
});

describe('GiftCard reservation-action layout (issue #211)', () => {
	it('renders a stored gift image key without replacing the persisted source URL', async () => {
		await renderCardInGridColumn(
			makeVisitorGift({
				imageUrl: null,
				imageKey: 'gifts/cam.jpg',
			}),
		);

		expect(document.querySelector('img')?.getAttribute('src')).toBe(
			'/api/upload/gifts/cam.jpg',
		);
	});

	it('stacks the mark-as-bought and cancel-reservation actions vertically at equal width', async () => {
		await renderCardInGridColumn(makeVisitorGift());

		const reserveButtonEl = document.querySelector(
			'[data-testid="reserve-button"]',
		) as HTMLElement;
		const purchasedButtonEl = reserveButtonEl.parentElement!.querySelector(
			'button:not([data-testid])',
		) as HTMLElement;

		expect(reserveButtonEl).toBeTruthy();
		expect(purchasedButtonEl).toBeTruthy();

		const reserveRect = reserveButtonEl.getBoundingClientRect();
		const purchasedRect = purchasedButtonEl.getBoundingClientRect();

		// Stacked: the reserve/cancel button sits below the purchased-toggle button,
		// not beside it (no vertical overlap).
		expect(reserveRect.top).toBeGreaterThanOrEqual(purchasedRect.bottom);
		// Equal width: both actions get `w-full` inside the shared `reservationActions`
		// column, rather than each sizing to its own (differently-localized) label.
		expect(reserveRect.width).toBeCloseTo(purchasedRect.width, 1);
	});

	it('keeps the footer within the rendered card width, even with a long name', async () => {
		await renderCardInGridColumn(makeVisitorGift());

		const cardEl = document
			.querySelector('[data-testid="reserve-button"]')
			?.closest('[class*="rounded-panel"]') as HTMLElement;
		const footerEl = cardEl.querySelector('.row-start-7') as HTMLElement;

		// The card's own box never exceeds its grid track (it already carries
		// `overflow-hidden` for the rounded corners/sticker, unrelated to this fix), so
		// checking the card against its host would pass whether or not the footer fix is
		// present. The footer-vs-card check below is what the fix actually protects:
		// before it, the unstacked button pair's min-content width dragged the footer
		// wider than the card (clipped invisibly by that pre-existing `overflow-hidden`,
		// but still a real layout defect internally).
		expect(footerEl.getBoundingClientRect().width).toBeLessThanOrEqual(
			cardEl.getBoundingClientRect().width + 0.5,
		);
	});
});
