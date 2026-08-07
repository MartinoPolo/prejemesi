import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import WishlistGiftDraggableWrapperTestHost from './WishlistGiftDraggableWrapperTestHost.svelte';

const baseProps = {
	index: 0,
	draggedIndex: null,
	dragOverIndex: null,
	dragOverStyle: 'ring' as const,
	giftName: 'Alpha Gift',
	onopendetail: () => {},
	onreorderpointerdown: () => {},
	onreordermove: () => {},
};

describe('WishlistGiftDraggableWrapper — drag grip gating (behavior B)', () => {
	it('renders the reorder grip for a manager', async () => {
		const screen = await render(WishlistGiftDraggableWrapperTestHost, {
			...baseProps,
			canManage: true,
		});

		await expect
			.element(screen.getByRole('button', { name: m.gift_reorder_grip_label() }))
			.toBeInTheDocument();
		await screen.unmount();
	});

	it('does not render the reorder grip for a visitor', async () => {
		const screen = await render(WishlistGiftDraggableWrapperTestHost, {
			...baseProps,
			canManage: false,
		});

		await expect
			.element(screen.getByRole('button', { name: m.gift_reorder_grip_label() }))
			.not.toBeInTheDocument();
		await screen.unmount();
	});
});

describe('WishlistGiftDraggableWrapper — grip follows the card hover lift (behavior C)', () => {
	it('scopes hover to the shared wrapper so the grip tracks the card lift', async () => {
		const { container, unmount } = await render(WishlistGiftDraggableWrapperTestHost, {
			...baseProps,
			canManage: true,
		});

		// The wrapper is the named hover group: hovering the card body OR the grip lifts both.
		const wrapper = container.querySelector('[data-gift-item]') as HTMLElement;
		expect(wrapper.className).toContain('group/gift-card');

		// The grip lifts in lock-step with the card via the same wrapper-group hover/focus trigger.
		const grip = wrapper.querySelector('button') as HTMLElement;
		expect(grip.className).toContain('group-hover/gift-card:-translate-y-1');
		expect(grip.className).toContain('group-focus-within/gift-card:-translate-y-1');
		await unmount();
	});
});
