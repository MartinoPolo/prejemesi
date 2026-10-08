import '../../../../app.css';
import { afterEach, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { createPixelAssertions } from '../../../../../tests/helpers/pixel-assertions.mjs';
import { giftCardCollectionLayout } from './gift_card_collection_layout.js';

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
