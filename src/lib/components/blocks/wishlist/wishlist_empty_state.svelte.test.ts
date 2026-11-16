import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import WishlistEmptyState from './WishlistEmptyState.svelte';

describe('WishlistEmptyState add-gift intent', () => {
	it('signals intent when the first-gift trigger is hovered or focused', async () => {
		const onaddgift = vi.fn();
		const onaddgiftintent = vi.fn();
		const screen = render(WishlistEmptyState, {
			isArchived: false,
			canManage: true,
			isFilteredEmpty: false,
			onaddgift,
			onaddgiftintent,
			onclearfilters: () => {},
		});
		const add = screen.getByRole('button', { name: m.wishlist_detail_add_first_wish_label() });
		expect(onaddgiftintent).not.toHaveBeenCalled();

		await add.hover();
		expect(onaddgiftintent).toHaveBeenCalled();

		onaddgiftintent.mockClear();
		(add.element() as HTMLButtonElement).focus();
		expect(onaddgiftintent).toHaveBeenCalledTimes(1);
		expect(onaddgift).not.toHaveBeenCalled();
		await screen.unmount();
	});
});
