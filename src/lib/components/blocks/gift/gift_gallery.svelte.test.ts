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

function nextAnimationFrame(): Promise<void> {
	return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/** The painted horizontal offset of a slide, read from its computed transform matrix. */
function slideOffsetX(slide: HTMLElement): number {
	return new DOMMatrixReadOnly(getComputedStyle(slide).transform).m41;
}

function currentSlideElement(host: HTMLElement): HTMLElement {
	return host.querySelector<HTMLElement>('[data-gallery-slide][data-current]')!;
}

function arrow(host: HTMLElement, direction: 'previous' | 'next'): HTMLElement | null {
	return host.querySelector<HTMLElement>(`[data-testid="gift-card-gallery-${direction}"]`);
}

/**
 * A primary touch pointer dragged across most of the card image, then lifted; `beforeLift` runs
 * while the finger still holds the image and receives how far the finger has travelled.
 */
async function swipe(
	host: HTMLElement,
	direction: 'left' | 'right',
	beforeLift?: (fingerTravel: number) => void,
) {
	const gallery = host.querySelector<HTMLElement>('[data-testid="gift-card-gallery"]')!;
	const rect = gallery.getBoundingClientRect();
	const y = rect.top + rect.height / 2;
	const [startX, endX] =
		direction === 'left'
			? [rect.right - 20, rect.left + 20]
			: [rect.left + 20, rect.right - 20];
	const pointer = (type: string, x: number) =>
		gallery.dispatchEvent(
			new PointerEvent(type, {
				bubbles: true,
				pointerId: 7,
				pointerType: 'touch',
				isPrimary: true,
				clientX: x,
				clientY: y,
			}),
		);
	pointer('pointerdown', startX);
	let fingerX = startX;
	for (const fraction of [0.2, 0.5, 0.8]) {
		fingerX = startX + (endX - startX) * fraction;
		pointer('pointermove', fingerX);
		await nextAnimationFrame();
	}
	beforeLift?.(fingerX - startX);
	pointer('pointerup', endX);
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

	it('browses with the arrows and stops at both ends, showing only arrows that lead somewhere', async () => {
		const host = await renderCard(3);

		expect(currentSlide(host)).toBe('0');
		expect(arrow(host, 'previous')).toBeNull();
		arrow(host, 'next')!.click();
		await expect.poll(() => currentSlide(host)).toBe('1');
		expect(arrow(host, 'previous')).not.toBeNull();
		expect(indicator(host)?.textContent).toContain(
			m.gift_gallery_position({ position: 2, count: 3 }),
		);
		arrow(host, 'next')!.click();
		await expect.poll(() => currentSlide(host)).toBe('2');
		expect(arrow(host, 'next')).toBeNull();
		arrow(host, 'previous')!.click();
		await expect.poll(() => currentSlide(host)).toBe('1');
		arrow(host, 'previous')!.click();
		await expect.poll(() => currentSlide(host)).toBe('0');
		expect(arrow(host, 'previous')).toBeNull();
	});

	it('keeps keyboard focus on the other arrow when the pressed one disappears at an end', async () => {
		const host = await renderCard(2);

		arrow(host, 'next')!.focus();
		await userEvent.keyboard('{Enter}');

		await expect.poll(() => currentSlide(host)).toBe('1');
		expect(arrow(host, 'next')).toBeNull();
		expect(document.activeElement).toBe(arrow(host, 'previous'));
	});

	it('hides every image but the shown one from assistive technology', async () => {
		const host = await renderCard(3);
		const next = arrow(host, 'next')!;
		await userEvent.hover(next);
		await expect.poll(() => host.querySelector('[data-gallery-slide="1"]')).not.toBeNull();
		const hiddenSlides = () =>
			[...host.querySelectorAll<HTMLElement>('[data-gallery-slide]')]
				.filter((slide) => slide.getAttribute('aria-hidden') === 'true')
				.map((slide) => slide.dataset.gallerySlide);

		expect(hiddenSlides()).toEqual(['1']);

		next.click();
		await expect.poll(() => currentSlide(host)).toBe('1');
		expect(hiddenSlides()).toEqual(['0', '2']);
		for (const slide of host.querySelectorAll('[data-gallery-slide]')) {
			expect(slide.querySelector('a, button, input, [tabindex]')).toBeNull();
		}
	});

	it('slides the next image in from the side and brings it to rest', async () => {
		const host = await renderCard(3);
		const next = arrow(host, 'next')!;
		await userEvent.hover(next);
		await expect.poll(() => host.querySelector('[data-gallery-slide="1"]')).not.toBeNull();

		next.click();
		await nextAnimationFrame();

		const incoming = currentSlideElement(host);
		expect(incoming.dataset.gallerySlide).toBe('1');
		expect(slideOffsetX(incoming), 'the image is not painted at rest yet').toBeGreaterThan(0);
		await expect.poll(() => slideOffsetX(incoming)).toBe(0);
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

	it('changes the image on a horizontal touch swipe', async () => {
		const host = await renderCard(3);

		await swipe(host, 'left');

		await expect.poll(() => currentSlide(host)).toBe('1');
	});

	it('resists a swipe past the cover and snaps back without wrapping to the last image', async () => {
		const host = await renderCard(3);
		const cover = currentSlideElement(host);
		let heldOffset = 0;
		let fingerTravel = 0;

		await swipe(host, 'right', (travelled) => {
			heldOffset = slideOffsetX(cover);
			fingerTravel = travelled;
		});

		expect(heldOffset, 'the cover follows the finger').toBeGreaterThan(0);
		expect(heldOffset, 'the cover lags behind the finger').toBeLessThan(fingerTravel);
		await expect.poll(() => slideOffsetX(cover)).toBe(0);
		expect(currentSlide(host)).toBe('0');
	});

	it('keeps the cover and its dot when a swipe or arrow key is tried in reorder and selection modes', async () => {
		const host = await renderCard(3, { contextualMode: true });

		await swipe(host, 'left');
		host.querySelector<HTMLElement>('a[href], button')?.focus();
		await userEvent.keyboard('{ArrowRight}');

		await expect.poll(() => currentSlide(host)).toBe('0');
		// The dots stay as the gallery's size cue, pinned to the cover.
		expect(indicator(host)?.dataset.kind).toBe('dots');
		expect(indicator(host)?.textContent).toContain(
			m.gift_gallery_position({ position: 1, count: 3 }),
		);
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

	it('keeps a single category beside the chip on one line instead of breaking a word', async () => {
		await page.viewport(390, 844);
		const gift = galleryGift(3, {
			categories: [
				{
					id: 'category-clothes',
					presetKey: null,
					customLabel: 'Oblečení',
					color: '#2563EB',
					sortOrder: 0,
				},
			],
			categoryIds: ['category-clothes'],
		});
		const host = await renderItem(gift, WISHLIST_ROLES.visitor, null, 358);
		const badge = host.querySelector<HTMLElement>('[data-testid="gift-category-badge"]')!;
		const chip = host.querySelector<HTMLElement>('[data-testid="gift-gallery-count-chip"]')!;
		const lineHeight = Number.parseFloat(getComputedStyle(badge).lineHeight);

		expect(badge.getBoundingClientRect().height).toBeLessThan(lineHeight * 2);
		expectRectanglesSeparated(badge.getBoundingClientRect(), chip.getBoundingClientRect());
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

		await userEvent.keyboard('{ArrowLeft}');
		await expect.poll(() => photoRegion.dataset.galleryIndex).toBe('1');
		expect(currentThumbnail()).toBe(1);
	});

	it('stops the arrow keys and arrows at both ends, showing only arrows that lead somewhere', async () => {
		const photoRegion = await renderViewer(3, 2);
		const viewerArrow = (direction: 'previous' | 'next') =>
			photoRegion.querySelector<HTMLElement>(
				`[data-testid="gift-viewer-gallery-${direction}"]`,
			);

		expect(viewerArrow('next')).toBeNull();
		await userEvent.keyboard('{ArrowRight}');
		expect(photoRegion.dataset.galleryIndex).toBe('2');

		await userEvent.keyboard('{ArrowLeft}');
		await userEvent.keyboard('{ArrowLeft}');
		await userEvent.keyboard('{ArrowLeft}');
		await expect.poll(() => photoRegion.dataset.galleryIndex).toBe('0');
		expect(viewerArrow('previous')).toBeNull();
		expect(viewerArrow('next')).not.toBeNull();
	});

	it('keeps keyboard focus on the other arrow when the pressed one disappears at an end', async () => {
		const photoRegion = await renderViewer(3, 1);
		const previous = photoRegion.querySelector<HTMLElement>(
			'[data-testid="gift-viewer-gallery-previous"]',
		)!;

		previous.focus();
		await userEvent.keyboard('{Enter}');

		await expect.poll(() => photoRegion.dataset.galleryIndex).toBe('0');
		expect(document.activeElement).toBe(
			photoRegion.querySelector('[data-testid="gift-viewer-gallery-next"]'),
		);
	});

	it('keeps keyboard focus on the other arrow when an arrow key reaches an end', async () => {
		const photoRegion = await renderViewer(3, 1);
		photoRegion.querySelector<HTMLElement>('[data-testid="gift-viewer-gallery-next"]')!.focus();

		await userEvent.keyboard('{ArrowRight}');

		await expect.poll(() => photoRegion.dataset.galleryIndex).toBe('2');
		expect(photoRegion.querySelector('[data-testid="gift-viewer-gallery-next"]')).toBeNull();
		expect(document.activeElement).toBe(
			photoRegion.querySelector('[data-testid="gift-viewer-gallery-previous"]'),
		);
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
