import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import WishlistGiftDraggableWrapperTestHost from './WishlistGiftDraggableWrapperTestHost.svelte';
import { createGiftPointerReorderController } from './gift_pointer_reorder.svelte.js';

const baseProps = {
	index: 0,
	giftId: 'gift-alpha',
	draggedGiftId: null,
	dragOverGiftId: null,
	dragOverStyle: 'ring' as const,
	giftName: 'Alpha Gift',
	onopendetail: () => {},
	onreorderpointerdown: () => {},
	onreordermove: () => {},
};

describe('WishlistGiftDraggableWrapper — explicit reorder mode (#239)', () => {
	it('renders the reorder grip while reorder mode is enabled', async () => {
		const screen = await render(WishlistGiftDraggableWrapperTestHost, {
			...baseProps,
			reorderEnabled: true,
		});

		await expect
			.element(screen.getByRole('button', { name: m.gift_reorder_grip_label() }))
			.toBeInTheDocument();
		await screen.unmount();
	});

	it('does not render the reorder grip outside reorder mode', async () => {
		const screen = await render(WishlistGiftDraggableWrapperTestHost, {
			...baseProps,
			reorderEnabled: false,
		});

		await expect
			.element(screen.getByRole('button', { name: m.gift_reorder_grip_label() }))
			.not.toBeInTheDocument();
		await screen.unmount();
	});
});

describe('WishlistGiftDraggableWrapper — grip follows the card hover lift', () => {
	it('scopes hover to the shared wrapper so the grip tracks the card lift', async () => {
		const { container, unmount } = await render(WishlistGiftDraggableWrapperTestHost, {
			...baseProps,
			reorderEnabled: true,
		});

		const wrapper = container.querySelector('[data-gift-item]') as HTMLElement;
		expect(wrapper.className).toContain('group/gift-card');
		const grip = wrapper.querySelector('button') as HTMLElement;
		expect(grip.className).toContain('group-hover/gift-card:-translate-y-1');
		expect(grip.className).toContain('group-focus-within/gift-card:-translate-y-1');
		await unmount();
	});
});

describe('gift pointer reorder controller (#239)', () => {
	function createItems() {
		return ['a', 'b', 'c'].map((id, index) => {
			const element = document.createElement('div');
			element.dataset.giftId = id;
			element.textContent = id;
			Object.defineProperty(element, 'getBoundingClientRect', {
				value: () => ({
					x: index * 100,
					y: 20,
					left: index * 100,
					top: 20,
					right: index * 100 + 80,
					bottom: 80,
					width: 80,
					height: 60,
					toJSON: () => {},
				}),
			});
			document.body.append(element);
			return element;
		});
	}

	function pointer(type: string, pointerId: number, clientX: number, clientY: number) {
		return new PointerEvent(type, {
			pointerId,
			pointerType: 'pen',
			button: 0,
			clientX,
			clientY,
			bubbles: true,
			cancelable: true,
		});
	}

	it('keeps an exact-size overlay and commits every live previewed id', () => {
		const items = createItems();
		const previews: string[][] = [];
		const commits: string[][] = [];
		const controller = createGiftPointerReorderController({
			getItemElements: () => items,
			getItemIds: () => ['a', 'b', 'c'],
			onPreviewOrder: (ids) => previews.push(ids),
			onCommitOrder: (ids) => commits.push(ids),
			onCancelOrder: () => {},
		});

		controller.start(pointer('pointerdown', 7, 20, 40), 0);
		const overlay = document.querySelector<HTMLElement>('[data-gift-reorder-overlay]');
		expect(overlay?.style.width).toBe('80px');
		expect(overlay?.style.height).toBe('60px');
		expect(overlay?.textContent).toBe('a');
		expect(items[0]!.style.visibility).toBe('hidden');

		window.dispatchEvent(pointer('pointermove', 7, 240, 40));
		expect(previews).toEqual([['b', 'c', 'a']]);
		window.dispatchEvent(pointer('pointerup', 7, 240, 40));
		expect(commits).toEqual([['b', 'c', 'a']]);
		expect(document.querySelector('[data-gift-reorder-overlay]')).toBeNull();
		expect(items[0]!.style.visibility).toBe('');
		items.forEach((item) => item.remove());
	});

	it.each([
		['pointercancel', () => window.dispatchEvent(pointer('pointercancel', 9, 240, 40))],
		['Escape', () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))],
	])('restores the pre-drag order on %s without committing', (_name, cancelDrag) => {
		const items = createItems();
		const cancellations: string[][] = [];
		const commits: string[][] = [];
		const controller = createGiftPointerReorderController({
			getItemElements: () => items,
			getItemIds: () => ['a', 'b', 'c'],
			onPreviewOrder: () => {},
			onCommitOrder: (ids) => commits.push(ids),
			onCancelOrder: (ids) => cancellations.push(ids),
		});

		controller.start(pointer('pointerdown', 9, 120, 40), 1);
		window.dispatchEvent(pointer('pointermove', 9, 240, 40));
		cancelDrag();
		expect(cancellations).toEqual([['a', 'b', 'c']]);
		expect(commits).toEqual([]);
		expect(document.querySelector('[data-gift-reorder-overlay]')).toBeNull();
		controller.destroy();
		items.forEach((item) => item.remove());
	});
});
