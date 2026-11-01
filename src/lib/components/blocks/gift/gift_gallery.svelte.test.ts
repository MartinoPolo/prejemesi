import '../../../../app.css';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import type { GiftImage } from '$lib/modules/gifts/gift_images.js';
import type { GiftForVisitor } from '$lib/modules/gifts/types.js';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import * as m from '$lib/paraglide/messages.js';
import {
	GiftCardTestHost,
	MOBILE_TWO_COLUMN_CARD_WIDTH,
	cleanupCardHosts,
	expectRectanglesSeparated,
	fixedHosts,
	makeVisitorGift,
} from './gift_card.test_fixtures.js';
import { renderItem } from './gift_list_item.test_fixtures.js';

vi.mock('$env/dynamic/public', () => ({ env: {} }));

const { default: GiftDetailModalTestHost } = await import('./GiftDetailModalTestHost.svelte');

function photo(width: number, height: number, fill: string): GiftImage {
	return {
		imageUrl:
			'data:image/svg+xml,' +
			encodeURIComponent(
				`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${fill}"/></svg>`,
			),
		imageKey: null,
		imageMeta: null,
	};
}

const PHOTOS = [
	photo(400, 300, '#ef4444'),
	photo(300, 400, '#22c55e'),
	photo(800, 300, '#3b82f6'),
	photo(300, 300, '#eab308'),
	photo(500, 300, '#a855f7'),
	photo(300, 500, '#14b8a6'),
	photo(600, 400, '#f97316'),
	photo(400, 400, '#64748b'),
];

function galleryGift(count: number, overrides: Partial<GiftForVisitor> = {}) {
	const images = PHOTOS.slice(0, count);
	return makeVisitorGift({
		imageUrl: images[0]?.imageUrl ?? null,
		images,
		reservedCount: 0,
		myReservationId: null,
		...overrides,
	});
}

async function renderCard(
	count: number,
	{
		contextualMode = false,
		width = 280,
		gift = galleryGift(count),
	}: { contextualMode?: boolean; width?: number; gift?: GiftForVisitor } = {},
) {
	await page.viewport(1280, 900);
	const host = document.createElement('div');
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	fixedHosts.add(host);
	await render(
		GiftCardTestHost,
		{ gift, role: WISHLIST_ROLES.visitor, isArchived: false, contextualMode },
		{ baseElement: host },
	);
	return host;
}

function currentSlide(host: HTMLElement): string | undefined {
	return host.querySelector<HTMLElement>('[data-gallery-slide][data-current]')?.dataset
		.gallerySlide;
}

function indicator(host: ParentNode): HTMLElement | null {
	return host.querySelector<HTMLElement>('[data-testid="gift-gallery-indicator"]');
}

afterEach(cleanupCardHosts);

describe('GiftCard gallery', () => {
	it('renders a single-image card without arrows or an indicator', async () => {
		const host = await renderCard(1);

		expect(host.querySelector('[data-testid="gift-card-crop-composition"]')).not.toBeNull();
		expect(host.querySelector('[data-testid="gift-card-gallery"]')).toBeNull();
		expect(host.querySelector('[data-testid="gift-card-gallery-next"]')).toBeNull();
		expect(indicator(host)).toBeNull();
	});

	it('cycles images with the arrows, wrapping at both ends', async () => {
		const host = await renderCard(3);
		const next = host.querySelector<HTMLElement>('[data-testid="gift-card-gallery-next"]')!;
		const previous = host.querySelector<HTMLElement>(
			'[data-testid="gift-card-gallery-previous"]',
		)!;

		expect(currentSlide(host)).toBe('0');
		previous.click();
		await expect.poll(() => currentSlide(host)).toBe('2');
		next.click();
		await expect.poll(() => currentSlide(host)).toBe('0');
		next.click();
		await expect.poll(() => currentSlide(host)).toBe('1');
		expect(indicator(host)?.textContent).toContain(
			m.gift_gallery_position({ position: 2, count: 3 }),
		);
	});

	it('shows dots up to six images and an n/N counter above that', async () => {
		const sixHost = await renderCard(6);
		expect(indicator(sixHost)?.dataset.kind).toBe('dots');
		cleanupCardHosts();

		const sevenHost = await renderCard(7);
		expect(indicator(sevenHost)?.dataset.kind).toBe('counter');
		expect(indicator(sevenHost)?.textContent).toContain('1/7');
	});

	it('shows the cover without arrows in reorder and selection modes', async () => {
		const host = await renderCard(3, { contextualMode: true });

		expect(currentSlide(host)).toBe('0');
		expect(host.querySelector('[data-testid="gift-card-gallery-next"]')).toBeNull();
	});

	it.each([MOBILE_TWO_COLUMN_CARD_WIDTH, 280])(
		'keeps the six-dot indicator clear of the priority badge on a %ipx card',
		async (width) => {
			const host = await renderCard(6, {
				width,
				gift: galleryGift(6, { priorityLabel: 'Stredni' }),
			});
			const priority = host.querySelector<HTMLElement>(
				'[data-testid="gift-priority-badge"]',
			)!;
			const imageFrame = host.querySelector<HTMLElement>(
				'[data-testid="gift-card-image-frame"]',
			)!;
			const indicatorRect = indicator(host)!.getBoundingClientRect();
			const frameRect = imageFrame.getBoundingClientRect();

			expectRectanglesSeparated(priority.getBoundingClientRect(), indicatorRect);
			expect(indicatorRect.left).toBeGreaterThanOrEqual(frameRect.left);
			expect(indicatorRect.right).toBeLessThanOrEqual(frameRect.right);
		},
	);
});

describe('GiftListItem gallery count', () => {
	it('labels the images after the cover with a +N chip', async () => {
		const host = await renderItem(galleryGift(3), WISHLIST_ROLES.visitor);
		const chip = host.querySelector<HTMLElement>('[data-testid="gift-gallery-count-chip"]');

		expect(chip?.textContent).toContain('+2');
		expect(chip?.textContent).toContain(m.gift_gallery_more_images_few({ count: 2 }));
		expect(host.querySelector('[data-testid="gift-card-gallery-next"]')).toBeNull();
		host.remove();
	});

	it('shows no chip for a single image', async () => {
		const host = await renderItem(galleryGift(1), WISHLIST_ROLES.visitor);

		expect(host.querySelector('[data-testid="gift-gallery-count-chip"]')).toBeNull();
		host.remove();
	});
});

describe('Gift viewer gallery', () => {
	async function renderViewer(count: number, cardGalleryIndex?: number) {
		await page.viewport(1280, 800);
		const gift = galleryGift(count);
		await render(GiftDetailModalTestHost, {
			open: true,
			mode: 'edit' as const,
			wishlistId: gift.wishlistId,
			priorityLevels: [],
			readOnly: true,
			gift,
			role: WISHLIST_ROLES.visitor,
			cardGalleryIndex,
		});
		await expect.element(page.getByRole('dialog')).toBeVisible();
		return document.querySelector<HTMLElement>('[data-testid="gift-viewer-photo"]')!;
	}

	function currentThumbnail(): number {
		return [
			...document.querySelectorAll<HTMLElement>('[data-testid="gift-viewer-thumbnail"]'),
		].findIndex((thumbnail) => thumbnail.getAttribute('aria-current') === 'true');
	}

	it('opens on the image the card showed and browses with the arrow keys', async () => {
		const photoRegion = await renderViewer(3, 2);

		expect(photoRegion.dataset.galleryIndex).toBe('2');
		expect(currentThumbnail()).toBe(2);
		expect(indicator(photoRegion)?.textContent).toContain('3/3');

		await userEvent.keyboard('{ArrowRight}');
		await expect.poll(() => photoRegion.dataset.galleryIndex).toBe('0');
		await userEvent.keyboard('{ArrowLeft}');
		await userEvent.keyboard('{ArrowLeft}');
		await expect.poll(() => photoRegion.dataset.galleryIndex).toBe('1');
		expect(currentThumbnail()).toBe(1);
	});

	it('sizes the photo column for the widest image so browsing keeps the dialog width', async () => {
		const photoRegion = await renderViewer(3);
		// The third photo is 8:3, the widest of the three.
		await expect
			.poll(() => photoRegion.style.getPropertyValue('--photo-aspect-ratio'))
			.toBe(String(800 / 300));
		const widthBefore = photoRegion.getBoundingClientRect().width;

		document.querySelectorAll<HTMLElement>('[data-testid="gift-viewer-thumbnail"]')[1]!.click();
		await expect.poll(() => photoRegion.dataset.galleryIndex).toBe('1');
		expect(photoRegion.getBoundingClientRect().width).toBe(widthBefore);
	});

	it('keeps the single photo viewer unchanged for one image', async () => {
		await renderViewer(1);

		expect(document.querySelector('[data-testid="gift-viewer-gallery"]')).toBeNull();
		expect(document.querySelector('[data-testid="gift-viewer-thumbnail"]')).toBeNull();
	});
});
