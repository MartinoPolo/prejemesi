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

/** Every touch pointer id a test presses, released so no test inherits another's fingers. */
const TOUCH_POINTER_IDS = [1, 2, 3];

afterEach(() => {
	vi.useRealTimers();
	for (const pointerId of TOUCH_POINTER_IDS) {
		window.dispatchEvent(pointerEvent('pointercancel', 'touch', { pointerId }));
	}
});

function pointerEvent(type: string, pointerType = 'mouse', init: PointerEventInit = {}) {
	return new PointerEvent(type, {
		bubbles: true,
		cancelable: true,
		pointerId: 1,
		pointerType,
		isPrimary: true,
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
		vi.advanceTimersByTime(499);
		expect(openContext).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
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

	it('opens the long-press actions at once when a mobile browser fires contextmenu first', async () => {
		vi.useFakeTimers();
		const openNativeContext = vi.fn(() => true);
		const openLongPressContext = vi.fn(() => true);
		const openDetail = vi.fn();
		const bubbledContextMenu = vi.fn();
		const { container, unmount } = await render(WishlistGiftDraggableWrapperTestHost, {
			...baseProps,
			reorderEnabled: false,
			oncontextmenu: openNativeContext,
			onlongpress: openLongPressContext,
			onopendetail: openDetail,
		});
		const wrapper = container.querySelector('[data-gift-item]') as HTMLElement;
		// Svelte delegates contextmenu to the mount root, so only listeners above it observe bubbling.
		document.addEventListener('contextmenu', bubbledContextMenu);

		wrapper.dispatchEvent(pointerEvent('pointerdown', 'touch'));
		vi.advanceTimersByTime(450);
		const contextMenu = pointerEvent('contextmenu', 'touch', { button: 2 });
		wrapper.dispatchEvent(contextMenu);
		expect(openLongPressContext).toHaveBeenCalledOnce();
		vi.advanceTimersByTime(150);
		wrapper.dispatchEvent(pointerEvent('pointerup', 'touch'));
		wrapper.click();

		expect(contextMenu.defaultPrevented).toBe(true);
		expect(bubbledContextMenu).not.toHaveBeenCalled();
		expect(openNativeContext).not.toHaveBeenCalled();
		expect(openLongPressContext).toHaveBeenCalledOnce();
		expect(openDetail).not.toHaveBeenCalled();
		document.removeEventListener('contextmenu', bubbledContextMenu);
		await unmount();
	});

	it('opens the long-press actions once when the touch contextmenu is a plain MouseEvent', async () => {
		vi.useFakeTimers();
		const openNativeContext = vi.fn(() => true);
		const openLongPressContext = vi.fn(() => true);
		const { container, unmount } = await render(WishlistGiftDraggableWrapperTestHost, {
			...baseProps,
			reorderEnabled: false,
			oncontextmenu: openNativeContext,
			onlongpress: openLongPressContext,
		});
		const wrapper = container.querySelector('[data-gift-item]') as HTMLElement;

		wrapper.dispatchEvent(pointerEvent('pointerdown', 'touch'));
		vi.advanceTimersByTime(450);
		const contextMenu = new MouseEvent('contextmenu', {
			bubbles: true,
			cancelable: true,
			button: 2,
		});
		wrapper.dispatchEvent(contextMenu);
		expect(openLongPressContext).toHaveBeenCalledOnce();
		vi.advanceTimersByTime(150);
		wrapper.dispatchEvent(pointerEvent('pointerup', 'touch'));

		expect(contextMenu.defaultPrevented).toBe(true);
		expect(openNativeContext).not.toHaveBeenCalled();
		expect(openLongPressContext).toHaveBeenCalledOnce();
		await unmount();
	});

	it('long-presses a fresh primary touch even when an earlier finger never reported its release', async () => {
		vi.useFakeTimers();
		const openContext = vi.fn(() => true);
		const { container, unmount } = await render(WishlistGiftDraggableWrapperTestHost, {
			...baseProps,
			reorderEnabled: false,
			onlongpress: openContext,
		});
		const wrapper = container.querySelector('[data-gift-item]') as HTMLElement;

		wrapper.dispatchEvent(pointerEvent('pointerdown', 'touch'));
		document.body.dispatchEvent(
			pointerEvent('pointerdown', 'touch', { pointerId: 2, isPrimary: false }),
		);
		wrapper.dispatchEvent(pointerEvent('pointerup', 'touch'));
		vi.advanceTimersByTime(600);
		expect(openContext).not.toHaveBeenCalled();

		wrapper.dispatchEvent(pointerEvent('pointerdown', 'touch', { pointerId: 3 }));
		vi.advanceTimersByTime(500);

		expect(openContext).toHaveBeenCalledOnce();
		wrapper.dispatchEvent(pointerEvent('pointerup', 'touch', { pointerId: 3 }));
		await unmount();
	});

	it('forgets fingers whose release was lost once the window blurs', async () => {
		vi.useFakeTimers();
		const openContext = vi.fn(() => true);
		const { container, unmount } = await render(WishlistGiftDraggableWrapperTestHost, {
			...baseProps,
			reorderEnabled: false,
			onlongpress: openContext,
		});
		const wrapper = container.querySelector('[data-gift-item]') as HTMLElement;

		wrapper.dispatchEvent(pointerEvent('pointerdown', 'touch'));
		document.body.dispatchEvent(
			pointerEvent('pointerdown', 'touch', { pointerId: 2, isPrimary: false }),
		);
		window.dispatchEvent(new Event('blur'));
		// Not primary, so only the blur can have dropped the two stale fingers.
		wrapper.dispatchEvent(
			pointerEvent('pointerdown', 'touch', { pointerId: 3, isPrimary: false }),
		);
		vi.advanceTimersByTime(500);

		expect(openContext).toHaveBeenCalledOnce();
		wrapper.dispatchEvent(pointerEvent('pointerup', 'touch', { pointerId: 3 }));
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

	describe.each([
		{ secondFingerLandsOn: 'the same card', onCard: true },
		{ secondFingerLandsOn: 'elsewhere on the page', onCard: false },
	])('a second finger on $secondFingerLandsOn', ({ onCard }) => {
		function addSecondFinger(wrapper: HTMLElement) {
			const secondFinger = pointerEvent('pointerdown', 'touch', {
				pointerId: 2,
				isPrimary: false,
				clientX: 120,
				clientY: 120,
			});
			(onCard ? wrapper : document.body).dispatchEvent(secondFinger);
		}

		function liftBothFingers(wrapper: HTMLElement) {
			wrapper.dispatchEvent(pointerEvent('pointerup', 'touch', { pointerId: 2 }));
			wrapper.dispatchEvent(pointerEvent('pointerup', 'touch'));
		}

		it('cancels the long press instead of restarting it', async () => {
			vi.useFakeTimers();
			const openContext = vi.fn(() => true);
			const { container, unmount } = await render(WishlistGiftDraggableWrapperTestHost, {
				...baseProps,
				reorderEnabled: false,
				onlongpress: openContext,
			});
			const wrapper = container.querySelector('[data-gift-item]') as HTMLElement;

			wrapper.dispatchEvent(pointerEvent('pointerdown', 'touch'));
			vi.advanceTimersByTime(200);
			addSecondFinger(wrapper);
			vi.advanceTimersByTime(700);

			expect(openContext).not.toHaveBeenCalled();
			expect(wrapper).not.toHaveAttribute('data-long-press-pending');
			liftBothFingers(wrapper);
			await unmount();
		});

		it('cancels the reorder long press, so no drag starts (#530)', async () => {
			vi.useFakeTimers();
			const startReorder = vi.fn();
			const { container, unmount } = await render(WishlistGiftDraggableWrapperTestHost, {
				...baseProps,
				reorderEnabled: true,
				onreorderpointerdown: startReorder,
			});
			const wrapper = container.querySelector('[data-gift-item]') as HTMLElement;

			wrapper.dispatchEvent(pointerEvent('pointerdown', 'touch'));
			vi.advanceTimersByTime(100);
			addSecondFinger(wrapper);
			vi.advanceTimersByTime(700);

			expect(startReorder).not.toHaveBeenCalled();
			liftBothFingers(wrapper);
			await unmount();
		});
	});

	describe('in selection mode', () => {
		async function renderSelection() {
			const toggle = vi.fn();
			const openContext = vi.fn(() => true);
			const screen = await render(WishlistGiftDraggableWrapperTestHost, {
				...baseProps,
				reorderEnabled: false,
				selectionMode: true,
				onselectiontoggle: toggle,
				onlongpress: openContext,
			});
			const wrapper = screen.container.querySelector('[data-gift-item]') as HTMLElement;
			return { toggle, openContext, wrapper, unmount: screen.unmount };
		}

		it('toggles the selection once when a touch long press completes, even if the release clicks', async () => {
			vi.useFakeTimers();
			const { toggle, openContext, wrapper, unmount } = await renderSelection();

			wrapper.dispatchEvent(pointerEvent('pointerdown', 'touch'));
			vi.advanceTimersByTime(499);
			expect(toggle).not.toHaveBeenCalled();
			vi.advanceTimersByTime(1);
			expect(toggle).toHaveBeenCalledExactlyOnceWith('gift-alpha');
			wrapper.dispatchEvent(pointerEvent('pointerup', 'touch'));
			wrapper.click();

			expect(toggle).toHaveBeenCalledOnce();
			expect(openContext).not.toHaveBeenCalled();
			await unmount();
		});

		it('toggles the selection once when the browser fires its long-press contextmenu', async () => {
			vi.useFakeTimers();
			const { toggle, openContext, wrapper, unmount } = await renderSelection();

			wrapper.dispatchEvent(pointerEvent('pointerdown', 'touch'));
			vi.advanceTimersByTime(450);
			const contextMenu = pointerEvent('contextmenu', 'touch', { button: 2 });
			wrapper.dispatchEvent(contextMenu);
			expect(toggle).toHaveBeenCalledOnce();
			vi.advanceTimersByTime(500);
			wrapper.dispatchEvent(pointerEvent('pointerup', 'touch'));

			expect(contextMenu.defaultPrevented).toBe(true);
			expect(toggle).toHaveBeenCalledOnce();
			expect(openContext).not.toHaveBeenCalled();
			await unmount();
		});

		it('toggles the selection once when the touch contextmenu is a plain MouseEvent', async () => {
			vi.useFakeTimers();
			const { toggle, openContext, wrapper, unmount } = await renderSelection();

			wrapper.dispatchEvent(pointerEvent('pointerdown', 'touch'));
			vi.advanceTimersByTime(450);
			const contextMenu = new MouseEvent('contextmenu', {
				bubbles: true,
				cancelable: true,
				button: 2,
			});
			wrapper.dispatchEvent(contextMenu);
			expect(toggle).toHaveBeenCalledOnce();
			vi.advanceTimersByTime(500);
			wrapper.dispatchEvent(pointerEvent('pointerup', 'touch'));
			wrapper.click();

			expect(contextMenu.defaultPrevented).toBe(true);
			expect(toggle).toHaveBeenCalledExactlyOnceWith('gift-alpha');
			expect(openContext).not.toHaveBeenCalled();
			await unmount();
		});

		it.each([
			[
				'moves more than 8 px',
				(wrapper: HTMLElement) => {
					wrapper.dispatchEvent(pointerEvent('pointermove', 'touch', { clientX: 89 }));
				},
			],
			['scrolls the page', () => document.dispatchEvent(new Event('scroll'))],
			[
				'adds a second finger',
				() => {
					document.body.dispatchEvent(
						pointerEvent('pointerdown', 'touch', { pointerId: 2, isPrimary: false }),
					);
				},
			],
		])('does not toggle the selection when a held touch %s', async (_name, interrupt) => {
			vi.useFakeTimers();
			const { toggle, openContext, wrapper, unmount } = await renderSelection();

			wrapper.dispatchEvent(pointerEvent('pointerdown', 'touch'));
			vi.advanceTimersByTime(200);
			interrupt(wrapper);
			vi.advanceTimersByTime(700);

			expect(toggle).not.toHaveBeenCalled();
			expect(openContext).not.toHaveBeenCalled();
			await unmount();
		});

		it('toggles the selection once, by its click, after a held mouse press', async () => {
			vi.useFakeTimers();
			const { toggle, openContext, wrapper, unmount } = await renderSelection();

			wrapper.dispatchEvent(pointerEvent('pointerdown'));
			vi.advanceTimersByTime(700);
			expect(toggle).not.toHaveBeenCalled();
			wrapper.dispatchEvent(pointerEvent('pointerup'));
			wrapper.click();

			expect(toggle).toHaveBeenCalledExactlyOnceWith('gift-alpha');
			expect(openContext).not.toHaveBeenCalled();
			await unmount();
		});

		it('toggles the selection once on a short touch tap', async () => {
			vi.useFakeTimers();
			const { toggle, wrapper, unmount } = await renderSelection();

			wrapper.dispatchEvent(pointerEvent('pointerdown', 'touch'));
			vi.advanceTimersByTime(100);
			wrapper.dispatchEvent(pointerEvent('pointerup', 'touch'));
			wrapper.click();
			vi.advanceTimersByTime(600);

			expect(toggle).toHaveBeenCalledExactlyOnceWith('gift-alpha');
			await unmount();
		});
	});
});
