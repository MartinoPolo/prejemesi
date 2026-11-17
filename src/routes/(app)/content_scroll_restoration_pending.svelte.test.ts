import { afterEach, describe, expect, it } from 'vitest';
import { GIFT_COLLECTION_MOUNTING_ATTRIBUTE } from '$lib/components/blocks/wishlist/gift_card_collection_layout.js';
import { startContentScrollRestore } from './content_scroll_restoration.svelte.js';

const SCROLLER_HEIGHT = 300;
const SAVED_TOP = 900;

let scroller: HTMLElement;
let content: HTMLElement;
let cancelRestore = () => {};

function mountScroller(contentHeight: number, mounting: boolean) {
	scroller = document.createElement('main');
	scroller.style.cssText = `height: ${SCROLLER_HEIGHT}px; overflow: auto;`;
	content = document.createElement('div');
	content.style.height = `${contentHeight}px`;
	content.toggleAttribute(GIFT_COLLECTION_MOUNTING_ATTRIBUTE, mounting);
	scroller.append(content);
	document.body.append(scroller);
}

function finishMounting(contentHeight: number) {
	content.style.height = `${contentHeight}px`;
	content.removeAttribute(GIFT_COLLECTION_MOUNTING_ATTRIBUTE);
}

async function frames(count: number) {
	for (let index = 0; index < count; index += 1) {
		await new Promise(requestAnimationFrame);
	}
}

afterEach(() => {
	cancelRestore();
	scroller.remove();
});

describe('pending content scroll restore', () => {
	it('waits for mounting gifts to reach the saved offset instead of clamping', async () => {
		mountScroller(500, true);
		cancelRestore = startContentScrollRestore(scroller, SAVED_TOP);
		await frames(3);
		expect(scroller.scrollTop).toBe(0);

		finishMounting(3000);
		await expect.poll(() => scroller.scrollTop).toBe(SAVED_TOP);
	});

	it('stays where the user scrolled once they scroll during the wait', async () => {
		mountScroller(500, true);
		cancelRestore = startContentScrollRestore(scroller, SAVED_TOP);
		await frames(1);
		scroller.dispatchEvent(new WheelEvent('wheel', { deltaY: 40 }));
		scroller.scrollTo({ top: 40, behavior: 'instant' });

		finishMounting(3000);
		await frames(3);
		expect(scroller.scrollTop).toBe(40);
	});

	it('ends at the bottom when the finished content is shorter than the saved offset', async () => {
		mountScroller(500, false);
		cancelRestore = startContentScrollRestore(scroller, SAVED_TOP);
		await expect.poll(() => scroller.scrollTop).toBe(500 - SCROLLER_HEIGHT);
	});
});
