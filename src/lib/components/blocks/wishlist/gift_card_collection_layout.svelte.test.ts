import '../../../../app.css';
import { afterEach, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { createPixelAssertions } from '../../../../../tests/helpers/pixel-assertions.mjs';
import type { GiftImage } from '$lib/modules/gifts/gift_images.js';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import { GIFT_CARD_LAYOUT_INERT_ATTRIBUTE } from '../gift/gift_card_layout_inert.js';
import { giftCardCollectionLayout } from './gift_card_collection_layout.js';

vi.mock('$env/dynamic/public', () => ({ env: {} }));

const { GiftCardTestHost, makeVisitorGift } = await import('../gift/gift_card.test_fixtures.js');

const { expectPixelsNear } = createPixelAssertions(expect);
const cleanups: (() => void)[] = [];

afterEach(() => {
	for (const cleanup of cleanups.splice(0)) {
		cleanup();
	}
	delete document.documentElement.dataset.depth;
});

async function nextLayout(): Promise<void> {
	await new Promise<void>((resolve) =>
		requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
	);
}

function renderCollectionWithDepthPaddedActions(): HTMLElement {
	const collection = document.createElement('div');
	collection.dataset.viewMode = 'card';
	collection.style.width = '600px';
	const grid = document.createElement('div');
	grid.dataset.testid = 'wishlist-gift-card-grid';
	grid.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; align-items: start';
	for (let index = 0; index < 2; index += 1) {
		const card = document.createElement('div');
		card.dataset.testid = 'gift-card-surface';
		const actions = document.createElement('div');
		actions.dataset.giftCardTrack = 'actions';
		actions.style.cssText =
			'min-height: var(--gift-card-actions-track-height, auto); padding-bottom: var(--depth-clearance)';
		const action = document.createElement('div');
		action.style.height = '20px';
		actions.append(action);
		card.append(actions);
		grid.append(card);
	}
	collection.append(grid);
	document.body.append(collection);
	const layout = giftCardCollectionLayout(collection);
	cleanups.push(() => {
		layout.destroy();
		collection.remove();
	});
	return collection;
}

it('re-measures card tracks when only the document depth changes', async () => {
	await page.viewport(1280, 720);
	document.documentElement.dataset.depth = 'soft';
	const collection = renderCollectionWithDepthPaddedActions();
	await nextLayout();
	const trackHeight = () =>
		Number.parseFloat(collection.style.getPropertyValue('--gift-card-actions-track-height'));
	const shadowOffset = Number.parseFloat(
		getComputedStyle(collection).getPropertyValue('--elevation-ordinary-offset'),
	);
	expectPixelsNear(trackHeight(), 20);

	document.documentElement.dataset.depth = 'black';
	await nextLayout();
	expectPixelsNear(trackHeight(), 20 + shadowOffset);

	document.documentElement.dataset.depth = 'soft';
	await nextLayout();
	expectPixelsNear(trackHeight(), 20);
});

it('keeps card tracks through a reorder drag and re-measures once it ends', async () => {
	await page.viewport(1280, 720);
	const collection = renderCollectionWithDepthPaddedActions();
	await nextLayout();
	const trackHeight = () =>
		Number.parseFloat(collection.style.getPropertyValue('--gift-card-actions-track-height'));
	expectPixelsNear(trackHeight(), 20);

	const card = collection.querySelector<HTMLElement>('[data-testid="gift-card-surface"]')!;
	card.dataset.giftMotionDragging = '';
	const extraAction = document.createElement('div');
	extraAction.style.height = '20px';
	card.querySelector('[data-gift-card-track="actions"]')!.append(extraAction);
	await nextLayout();
	expectPixelsNear(trackHeight(), 20);

	delete card.dataset.giftMotionDragging;
	await nextLayout();
	expectPixelsNear(trackHeight(), 40);
});

it('ignores gallery browsing but re-measures when anything else in the card changes', async () => {
	await page.viewport(1280, 720);
	const collection = renderCollectionWithDepthPaddedActions();
	const card = collection.querySelector<HTMLElement>('[data-testid="gift-card-surface"]')!;
	const gallery = document.createElement('div');
	gallery.setAttribute(GIFT_CARD_LAYOUT_INERT_ATTRIBUTE, '');
	const slide = document.createElement('div');
	const counter = document.createElement('span');
	counter.textContent = '1/3';
	gallery.append(slide, counter);
	card.prepend(gallery);
	await nextLayout();
	// The counter is the file's first text, so its web font is still loading here; the measurement
	// a finished font load rightly triggers must not land inside the window checked below.
	await document.fonts.ready;
	await nextLayout();
	const trackHeight = () =>
		Number.parseFloat(collection.style.getPropertyValue('--gift-card-actions-track-height'));
	expectPixelsNear(trackHeight(), 20);
	// A stale value that only a fresh measurement replaces.
	collection.style.setProperty('--gift-card-actions-track-height', '999px');

	slide.classList.add('invisible');
	gallery.classList.add('browsed');
	gallery.append(document.createElement('button'));
	counter.firstChild!.nodeValue = '2/3';
	await nextLayout();
	expect(trackHeight()).toBe(999);

	slide.classList.remove('invisible');
	card.querySelector('[data-gift-card-track="actions"]')!.classList.add('changed');
	await nextLayout();
	expectPixelsNear(trackHeight(), 20);
});

function galleryPhoto(fill: string): GiftImage {
	return {
		imageUrl:
			'data:image/svg+xml,' +
			encodeURIComponent(
				`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="100%" height="100%" fill="${fill}"/></svg>`,
			),
		imageKey: null,
		imageMeta: null,
	};
}

/** Counts layout measurements: every measurement rewrites the collection's description flag. */
function countMeasurements(collection: HTMLElement): { readonly count: number } {
	const counter = { count: 0 };
	const observer = new MutationObserver((records) => {
		counter.count += records.length;
	});
	observer.observe(collection, {
		attributes: true,
		attributeFilter: ['data-gift-card-has-descriptions'],
	});
	cleanups.push(() => observer.disconnect());
	return counter;
}

it('skips re-measuring when a real gift card browses its gallery but not when the card changes', async () => {
	await page.viewport(1280, 900);
	const collection = document.createElement('div');
	collection.dataset.viewMode = 'card';
	const grid = document.createElement('div');
	grid.dataset.testid = 'wishlist-gift-card-grid';
	grid.style.cssText = 'display: grid; grid-template-columns: 280px 280px; align-items: start';
	collection.append(grid);
	document.body.append(collection);
	cleanups.push(() => collection.remove());
	const images = [galleryPhoto('#ef4444'), galleryPhoto('#22c55e'), galleryPhoto('#3b82f6')];
	await render(
		GiftCardTestHost,
		{
			gift: makeVisitorGift({
				imageUrl: images[0]!.imageUrl,
				images,
				reservedCount: 0,
				myReservationId: null,
			}),
			role: WISHLIST_ROLES.visitor,
			isArchived: false,
		},
		{ baseElement: grid },
	);
	const layout = giftCardCollectionLayout(collection);
	cleanups.push(() => layout.destroy());
	await document.fonts.ready;
	await nextLayout();
	const measurements = countMeasurements(collection);
	const shownSlide = () =>
		collection.querySelector<HTMLElement>('[data-gallery-slide][data-current]')?.dataset
			.gallerySlide;

	collection.querySelector<HTMLElement>('[data-testid="gift-card-gallery-next"]')!.click();
	await expect.poll(shownSlide).toBe('1');
	await nextLayout();
	await nextLayout();
	expect(measurements.count, 'browsing the gallery re-measured the layout').toBe(0);

	collection.querySelector('[data-gift-card-track="title"]')!.classList.add('changed');
	await expect.poll(() => measurements.count).toBeGreaterThan(0);
});
