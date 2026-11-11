// Card controls own their presses: a touch on one inside the card wrapper behaves as it does
// anywhere else, while presses on card content keep the card's gestures.
import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import * as m from '$lib/paraglide/messages.js';
import type { PublicGiftCategory } from '$lib/modules/gift-categories/types.js';
import WishlistGiftDraggableWrapperCategoryTestHost from './WishlistGiftDraggableWrapperCategoryTestHost.svelte';

const CATEGORIES: PublicGiftCategory[] = [
	'Elektronika',
	'Cestování',
	'Hudba a poslech',
	'Dárky pro kutily',
].map((label, index) => ({
	id: `category-${index}`,
	presetKey: null,
	customLabel: label,
	color: '#0369A1',
	sortOrder: index,
}));

const baseProps = {
	index: 0,
	totalCount: 1,
	giftId: 'gift-alpha',
	draggedGiftId: null,
	dragOverGiftId: null,
	dragOverStyle: 'ring' as const,
	giftName: 'Alpha Gift',
	primaryLink: null,
	onreorderpointerdown: () => {},
	onreordermove: () => {},
	categories: CATEGORIES,
};

afterEach(() => {
	window.dispatchEvent(
		new PointerEvent('pointercancel', { pointerId: 1, pointerType: 'touch', isPrimary: true }),
	);
	document.body.querySelectorAll('[data-slot="popover-content"]').forEach((popover) => {
		popover.remove();
	});
});

/** A finger tap: the browser clicks after the finger lifts, a few frames after it landed. */
async function touchTap(target: HTMLElement) {
	const box = target.getBoundingClientRect();
	const init: PointerEventInit = {
		bubbles: true,
		cancelable: true,
		pointerId: 1,
		pointerType: 'touch',
		isPrimary: true,
		clientX: box.left + box.width / 2,
		clientY: box.top + box.height / 2,
	};
	target.dispatchEvent(new PointerEvent('pointerdown', init));
	await new Promise((resolve) => setTimeout(resolve, 50));
	target.dispatchEvent(new PointerEvent('pointerup', init));
	target.click();
}

/**
 * Opens the page popover and waits for it to settle, as a person would before the next press:
 * Bits UI re-arms the popover's outside-press detection while it mounts and ignores a press
 * landing in that brief window.
 */
async function openPagePopover() {
	await userEvent.click(page.getByRole('button', { name: 'Page popover' }));
	const pagePopover = page.getByTestId('page-popover');
	await expect.element(pagePopover).toBeVisible();
	const pagePopoverElement = pagePopover.element() as HTMLElement;
	await Promise.all(pagePopoverElement.getAnimations().map((animation) => animation.finished));
	return pagePopover;
}

/** The "+X" chip's accessible name for any hidden count, which depends on the lane width. */
const MORE_CHIP_NAME = new RegExp(`^${m.gift_category_more_label({ count: String.raw`\d+` })}$`);

async function moreChip(): Promise<HTMLElement> {
	const chip = page.getByRole('button', { name: MORE_CHIP_NAME });
	await expect.element(chip).toBeVisible();
	return chip.element() as HTMLElement;
}

describe('WishlistGiftDraggableWrapper — card controls', () => {
	it('opens the category "+X" popover on a touch tap without opening the gift', async () => {
		const openDetail = vi.fn();
		const { unmount } = await render(WishlistGiftDraggableWrapperCategoryTestHost, {
			...baseProps,
			reorderEnabled: false,
			onopendetail: openDetail,
		});

		await touchTap(await moreChip());

		const popover = page.getByRole('dialog', { name: m.gift_category_more_title() });
		await expect.element(popover).toBeVisible();
		expect(openDetail).not.toHaveBeenCalled();
		await unmount();
	});

	it('lets a touch tap on a card control dismiss a popover open elsewhere on the page', async () => {
		const { unmount } = await render(WishlistGiftDraggableWrapperCategoryTestHost, {
			...baseProps,
			reorderEnabled: false,
			onopendetail: () => {},
		});
		const pagePopover = await openPagePopover();

		await touchTap(await moreChip());

		await expect.element(pagePopover).not.toBeInTheDocument();
		await expect
			.element(page.getByRole('dialog', { name: m.gift_category_more_title() }))
			.toBeVisible();
		await unmount();
	});

	it('lets a touch press on any element marked data-prevent-gift-card-open through without opening the gift', async () => {
		const openDetail = vi.fn();
		const { unmount } = await render(WishlistGiftDraggableWrapperCategoryTestHost, {
			...baseProps,
			reorderEnabled: false,
			onopendetail: openDetail,
			preventOpenMarker: true,
		});
		const pagePopover = await openPagePopover();

		await touchTap(page.getByText('Card marker').element() as HTMLElement);

		await expect.element(pagePopover).not.toBeInTheDocument();
		expect(openDetail).not.toHaveBeenCalled();
		await unmount();
	});
});
