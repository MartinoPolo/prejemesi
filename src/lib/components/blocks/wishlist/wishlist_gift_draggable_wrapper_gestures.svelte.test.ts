import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import WishlistGiftDraggableWrapperTestHost from './WishlistGiftDraggableWrapperTestHost.svelte';

const baseProps = {
	index: 0,
	totalCount: 2,
	giftId: 'gift-alpha',
	draggedGiftId: null,
	dragOverGiftId: null,
	dragOverStyle: 'ring' as const,
	giftName: 'Alpha Gift',
	primaryLink: null,
	onopendetail: () => {},
	onreorderpointerdown: () => {},
	onreordermove: () => {},
};

afterEach(() => {
	vi.useRealTimers();
});

function pointerEvent(type: string, pointerType = 'mouse', init: PointerEventInit = {}) {
	return new PointerEvent(type, {
		bubbles: true,
		cancelable: true,
		pointerId: 1,
		pointerType,
		clientX: 80,
		clientY: 80,
		...init,
	});
}

describe('WishlistGiftDraggableWrapper — pointer gestures', () => {
	it('leaves touch scrolling unblocked outside the reorder handle', async () => {
		const { container, unmount } = await render(WishlistGiftDraggableWrapperTestHost, {
			...baseProps,
			reorderEnabled: true,
		});
		const content = container.querySelector('[data-testid="card-placeholder"]') as HTMLElement;
		const down = new PointerEvent('pointerdown', {
			bubbles: true,
			cancelable: true,
			pointerId: 1,
			pointerType: 'touch',
			clientX: 80,
			clientY: 80,
		});

		content.dispatchEvent(down);

		expect(down.defaultPrevented).toBe(false);
		expect(getComputedStyle(content).touchAction).not.toBe('none');
		await unmount();
	});

	it('opens detail after a short touch tap without preventing the synthesized click', async () => {
		const openDetail = vi.fn();
		const { container, unmount } = await render(WishlistGiftDraggableWrapperTestHost, {
			...baseProps,
			reorderEnabled: false,
			onopendetail: openDetail,
		});
		const wrapper = container.querySelector('[data-gift-item]') as HTMLElement;
		const down = new PointerEvent('pointerdown', {
			bubbles: true,
			cancelable: true,
			pointerId: 1,
			pointerType: 'touch',
			clientX: 12,
			clientY: 18,
		});

		wrapper.dispatchEvent(down);
		wrapper.dispatchEvent(
			new PointerEvent('pointerup', {
				bubbles: true,
				cancelable: true,
				pointerId: 1,
				pointerType: 'touch',
			}),
		);
		wrapper.click();

		expect(down.defaultPrevented).toBe(false);
		expect(openDetail).toHaveBeenCalledOnce();
		await unmount();
	});

	it('opens context on a completed long press without opening detail behind it', async () => {
		vi.useFakeTimers();
		const openDetail = vi.fn();
		const openContext = vi.fn(() => true);
		const { container, unmount } = await render(WishlistGiftDraggableWrapperTestHost, {
			...baseProps,
			reorderEnabled: false,
			onopendetail: openDetail,
			onlongpress: openContext,
		});
		const wrapper = container.querySelector('[data-gift-item]') as HTMLElement;

		wrapper.dispatchEvent(
			new PointerEvent('pointerdown', {
				bubbles: true,
				cancelable: true,
				pointerId: 1,
				pointerType: 'touch',
				clientX: 12,
				clientY: 18,
			}),
		);
		vi.advanceTimersByTime(600);
		wrapper.dispatchEvent(
			new PointerEvent('pointerup', {
				bubbles: true,
				cancelable: true,
				pointerId: 1,
				pointerType: 'touch',
			}),
		);
		wrapper.click();
		wrapper.click();

		expect(openContext).toHaveBeenCalledOnce();
		expect(openDetail).toHaveBeenCalledTimes(1);
		await unmount();
	});

	it('leaves the contextmenu a mobile long press fires to the long-press recognizer', async () => {
		vi.useFakeTimers();
		const openNativeContext = vi.fn(() => true);
		const openLongPressContext = vi.fn(() => true);
		const bubbledContextMenu = vi.fn();
		const { container, unmount } = await render(WishlistGiftDraggableWrapperTestHost, {
			...baseProps,
			reorderEnabled: false,
			oncontextmenu: openNativeContext,
			onlongpress: openLongPressContext,
		});
		const wrapper = container.querySelector('[data-gift-item]') as HTMLElement;
		// Svelte delegates contextmenu to the mount root, so only listeners above it observe bubbling.
		document.addEventListener('contextmenu', bubbledContextMenu);

		wrapper.dispatchEvent(pointerEvent('pointerdown', 'touch'));
		vi.advanceTimersByTime(450);
		const contextMenu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
		wrapper.dispatchEvent(contextMenu);
		vi.advanceTimersByTime(150);

		expect(contextMenu.defaultPrevented).toBe(true);
		expect(bubbledContextMenu).not.toHaveBeenCalled();
		expect(openNativeContext).not.toHaveBeenCalled();
		expect(openLongPressContext).toHaveBeenCalledOnce();
		document.removeEventListener('contextmenu', bubbledContextMenu);
		await unmount();
	});

	it('still opens the native context menu for a mouse right-click', async () => {
		const openNativeContext = vi.fn(() => true);
		const { container, unmount } = await render(WishlistGiftDraggableWrapperTestHost, {
			...baseProps,
			reorderEnabled: false,
			oncontextmenu: openNativeContext,
		});
		const wrapper = container.querySelector('[data-gift-item]') as HTMLElement;

		wrapper.dispatchEvent(pointerEvent('pointerdown', 'mouse', { button: 2 }));
		wrapper.dispatchEvent(pointerEvent('contextmenu', 'mouse', { button: 2 }));

		expect(openNativeContext).toHaveBeenCalledOnce();
		await unmount();
	});

	it.each(['mouse', 'pen'])(
		'starts a reorder drag when a %s press lands anywhere on the card (#530)',
		async (pointerType) => {
			const startReorder = vi.fn();
			const { container, unmount } = await render(WishlistGiftDraggableWrapperTestHost, {
				...baseProps,
				index: 1,
				reorderEnabled: true,
				onreorderpointerdown: startReorder,
			});
			const down = pointerEvent('pointerdown', pointerType);

			container.querySelector('[data-testid="image-placeholder"]')!.dispatchEvent(down);

			expect(startReorder).toHaveBeenCalledExactlyOnceWith(down, 1);
			await unmount();
		},
	);

	it('starts one drag, not two, when a mouse press lands on the grip (#530)', async () => {
		const startReorder = vi.fn();
		const { container, unmount } = await render(WishlistGiftDraggableWrapperTestHost, {
			...baseProps,
			reorderEnabled: true,
			onreorderpointerdown: startReorder,
		});

		container
			.querySelector('[data-gift-reorder-grip]')!
			.dispatchEvent(pointerEvent('pointerdown'));

		expect(startReorder).toHaveBeenCalledOnce();
		await unmount();
	});

	it('does not drag from a press outside reorder mode', async () => {
		const startReorder = vi.fn();
		const { container, unmount } = await render(WishlistGiftDraggableWrapperTestHost, {
			...baseProps,
			reorderEnabled: false,
			onreorderpointerdown: startReorder,
		});

		container
			.querySelector('[data-testid="card-placeholder"]')!
			.dispatchEvent(pointerEvent('pointerdown'));

		expect(startReorder).not.toHaveBeenCalled();
		await unmount();
	});

	it('starts a touch drag outside the grip only after a 300 ms long press (#530)', async () => {
		vi.useFakeTimers();
		const startReorder = vi.fn();
		const { container, unmount } = await render(WishlistGiftDraggableWrapperTestHost, {
			...baseProps,
			index: 1,
			reorderEnabled: true,
			onreorderpointerdown: startReorder,
		});
		const down = pointerEvent('pointerdown', 'touch');

		container.querySelector('[data-testid="card-placeholder"]')!.dispatchEvent(down);
		vi.advanceTimersByTime(299);
		expect(startReorder).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);

		expect(down.defaultPrevented).toBe(false);
		expect(startReorder).toHaveBeenCalledExactlyOnceWith(down, 1);
		await unmount();
	});

	it.each([
		[
			'moves past the long-press tolerance',
			(wrapper: HTMLElement) => {
				wrapper.dispatchEvent(pointerEvent('pointermove', 'touch', { clientY: 100 }));
			},
		],
		['scrolls the page', () => document.dispatchEvent(new Event('scroll'))],
		[
			'lifts before the long press completes',
			(wrapper: HTMLElement) => {
				wrapper.dispatchEvent(pointerEvent('pointerup', 'touch'));
			},
		],
	])('keeps a touch that %s from dragging the card (#530)', async (_name, interrupt) => {
		vi.useFakeTimers();
		const startReorder = vi.fn();
		const { container, unmount } = await render(WishlistGiftDraggableWrapperTestHost, {
			...baseProps,
			reorderEnabled: true,
			onreorderpointerdown: startReorder,
		});
		const wrapper = container.querySelector('[data-gift-item]') as HTMLElement;

		wrapper.dispatchEvent(pointerEvent('pointerdown', 'touch'));
		interrupt(wrapper);
		vi.advanceTimersByTime(600);

		expect(startReorder).not.toHaveBeenCalled();
		await unmount();
	});

	it.each([
		{ reorderEnabled: true, draggedGiftId: 'gift-alpha', prevented: true },
		{ reorderEnabled: true, draggedGiftId: null, prevented: false },
		{ reorderEnabled: true, draggedGiftId: 'gift-beta', prevented: false },
		{ reorderEnabled: false, draggedGiftId: null, prevented: false },
	])(
		'cancels touch scrolling only while this card is dragged: $draggedGiftId in reorder $reorderEnabled (#530)',
		async ({ reorderEnabled, draggedGiftId, prevented }) => {
			const { container, unmount } = await render(WishlistGiftDraggableWrapperTestHost, {
				...baseProps,
				reorderEnabled,
				draggedGiftId,
			});
			const move = new TouchEvent('touchmove', { bubbles: true, cancelable: true });

			container.querySelector('[data-gift-item]')!.dispatchEvent(move);

			expect(move.defaultPrevented).toBe(prevented);
			await unmount();
		},
	);

	it('cancels only the pending long press when touch scrolling starts', async () => {
		vi.useFakeTimers();
		const openContext = vi.fn(() => true);
		const screen = await render(WishlistGiftDraggableWrapperTestHost, {
			...baseProps,
			reorderEnabled: false,
			onlongpress: openContext,
		});
		const wrapper = document.querySelector('[data-gift-item]') as HTMLElement;

		wrapper.dispatchEvent(
			new PointerEvent('pointerdown', {
				bubbles: true,
				cancelable: true,
				pointerId: 1,
				pointerType: 'touch',
				clientX: 12,
				clientY: 18,
			}),
		);
		document.dispatchEvent(new Event('scroll'));
		vi.advanceTimersByTime(600);

		expect(openContext).not.toHaveBeenCalled();
		await screen.unmount();
	});
});
