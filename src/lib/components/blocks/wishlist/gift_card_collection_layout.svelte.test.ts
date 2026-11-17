import '../../../../app.css';
import { afterEach, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { createPixelAssertions } from '../../../../../tests/helpers/pixel-assertions.mjs';
import type { GiftImage } from '$lib/modules/gifts/gift_images.js';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import { GIFT_CARD_LAYOUT_INERT_ATTRIBUTE } from '../gift/gift_card_layout_inert.js';
import {
	giftCardCollectionLayout,
	measureGiftCardCollectionLayoutNow,
} from './gift_card_collection_layout.js';

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

function firstActionsTrack(collection: HTMLElement): HTMLElement {
	return collection.querySelector<HTMLElement>('[data-gift-card-track="actions"]')!;
}

function actionsTrackHeight(collection: HTMLElement): number {
	return Number.parseFloat(
		firstActionsTrack(collection).style.getPropertyValue('--gift-card-actions-track-height'),
	);
}

function renderCollectionWithDepthPaddedActions({
	columns = '1fr 1fr',
	actionHeights = [20, 20],
} = {}): HTMLElement {
	const collection = document.createElement('div');
	collection.dataset.viewMode = 'card';
	collection.style.width = '600px';
	const grid = document.createElement('div');
	grid.dataset.testid = 'wishlist-gift-card-grid';
	grid.style.cssText = `display: grid; grid-template-columns: ${columns}; align-items: start`;
	for (const actionHeight of actionHeights) {
		const card = document.createElement('div');
		card.dataset.testid = 'gift-card-surface';
		const actions = document.createElement('div');
		actions.dataset.giftCardTrack = 'actions';
		actions.style.cssText =
			'min-height: var(--gift-card-actions-track-height, auto); padding-bottom: var(--depth-clearance)';
		const action = document.createElement('div');
		action.style.height = `${actionHeight}px`;
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

it('aligns side-by-side cards to the tallest track and leaves single-column cards natural', async () => {
	await page.viewport(1280, 720);
	const actionTracks = (collection: HTMLElement) =>
		Array.from(collection.querySelectorAll<HTMLElement>('[data-gift-card-track="actions"]'));

	const sideBySide = renderCollectionWithDepthPaddedActions({ actionHeights: [20, 40] });
	await nextLayout();
	expect(sideBySide.dataset.giftCardTracksAligned).toBe('true');
	for (const track of actionTracks(sideBySide)) {
		expectPixelsNear(track.getBoundingClientRect().height, 40);
	}

	const singleColumn = renderCollectionWithDepthPaddedActions({
		columns: '1fr',
		actionHeights: [20, 40],
	});
	await nextLayout();
	expect(singleColumn.dataset.giftCardTracksAligned).toBeUndefined();
	const [shortTrack, tallTrack] = actionTracks(singleColumn);
	expectPixelsNear(shortTrack!.getBoundingClientRect().height, 20);
	expectPixelsNear(tallTrack!.getBoundingClientRect().height, 40);
});

it('aligns tracks to layout heights while an entering card is still scaled down', async () => {
	await page.viewport(1280, 720);
	const collection = renderCollectionWithDepthPaddedActions({ actionHeights: [20, 40] });
	const cards = collection.querySelectorAll<HTMLElement>('[data-testid="gift-card-surface"]');
	cards[1]!.style.transform = 'scale(0.5)';
	await nextLayout();

	expectPixelsNear(actionsTrackHeight(collection), 40);
});

it('re-measures card tracks when only the document depth changes', async () => {
	await page.viewport(1280, 720);
	document.documentElement.dataset.depth = 'soft';
	const collection = renderCollectionWithDepthPaddedActions();
	await nextLayout();
	const trackHeight = () => actionsTrackHeight(collection);
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
	const trackHeight = () => actionsTrackHeight(collection);
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
	const trackHeight = () => actionsTrackHeight(collection);
	expectPixelsNear(trackHeight(), 20);
	// A stale value that only a fresh measurement replaces.
	firstActionsTrack(collection).style.setProperty('--gift-card-actions-track-height', '999px');

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

/** Counts layout measurements: every measurement marks the collection as measuring once. */
function countMeasurements(collection: HTMLElement): { readonly count: number } {
	const counter = { count: 0 };
	const observer = new MutationObserver((records) => {
		counter.count += records.filter((record) => record.oldValue === null).length;
	});
	observer.observe(collection, {
		attributes: true,
		attributeOldValue: true,
		attributeFilter: ['data-gift-card-measuring'],
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

it('leaves the track heights untouched when a re-measurement finds the same heights', async () => {
	await page.viewport(1280, 720);
	const collection = renderCollectionWithDepthPaddedActions();
	await document.fonts.ready;
	await nextLayout();
	const measurements = countMeasurements(collection);
	const styleWrites: MutationRecord[] = [];
	const observer = new MutationObserver((records) => styleWrites.push(...records));
	observer.observe(collection, { attributes: true, attributeFilter: ['style'], subtree: true });
	cleanups.push(() => observer.disconnect());

	collection.querySelector('[data-gift-card-track="actions"]')!.classList.add('unchanged-size');
	await nextLayout();
	expect(measurements.count).toBe(1);
	expect(styleWrites).toHaveLength(0);
	expectPixelsNear(actionsTrackHeight(collection), 20);
});

it('measures once when a direct measurement follows changes the observers already saw', async () => {
	await page.viewport(1280, 720);
	const collection = renderCollectionWithDepthPaddedActions();
	await document.fonts.ready;
	await nextLayout();
	const measurements = countMeasurements(collection);
	const actions = collection.querySelector('[data-gift-card-track="actions"]')!;

	actions.classList.add('observed-before');
	await Promise.resolve();
	measureGiftCardCollectionLayoutNow(collection);
	await nextLayout();
	expect(measurements.count, 'change seen by the observer first').toBe(1);

	actions.classList.add('measured-before');
	measureGiftCardCollectionLayoutNow(collection);
	await nextLayout();
	expect(measurements.count, 'change measured before the observer ran').toBe(2);

	actions.classList.add('after-direct');
	await nextLayout();
	expect(measurements.count, 'a later change still re-measures').toBe(3);
});
