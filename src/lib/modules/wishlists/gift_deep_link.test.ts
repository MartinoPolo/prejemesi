import { describe, expect, it, vi } from 'vitest';
import { consumeGiftDeepLink } from './gift_deep_link.js';

const gifts = [{ id: 'gift-1' }, { id: 'gift-2' }];

describe('consumeGiftDeepLink', () => {
	it('opens a valid requested gift once after consuming its marker', () => {
		let currentUrl = new URL('https://prejemesi.cz/w/list-1?gift=gift-1');
		const openGift = vi.fn(() => {
			expect(currentUrl.searchParams.has('gift')).toBe(false);
		});

		consumeGiftDeepLink({
			url: currentUrl,
			gifts,
			onConsume: (cleanedUrl) => {
				currentUrl = cleanedUrl;
			},
			onOpen: openGift,
		});
		consumeGiftDeepLink({
			url: currentUrl,
			gifts,
			onConsume: vi.fn(),
			onOpen: openGift,
		});

		expect(currentUrl.toString()).toBe('https://prejemesi.cz/w/list-1');
		expect(openGift).toHaveBeenCalledOnce();
		expect(openGift).toHaveBeenCalledWith(gifts[0]);
	});

	it('consumes a missing gift marker without trying to open a gift', () => {
		const url = new URL('https://prejemesi.cz/w/list-1?gift=deleted-gift');
		const onConsume = vi.fn();
		const onOpen = vi.fn();

		consumeGiftDeepLink({ url, gifts, onConsume, onOpen });

		expect(onConsume).toHaveBeenCalledOnce();
		expect(onConsume.mock.calls[0]?.[0].toString()).toBe('https://prejemesi.cz/w/list-1');
		expect(onOpen).not.toHaveBeenCalled();
	});

	it('opens a later gift when a new notification navigation supplies a new marker', () => {
		let currentUrl = new URL('https://prejemesi.cz/w/list-1?gift=gift-1');
		const openGift = vi.fn();
		const consumeCurrentMarker = () =>
			consumeGiftDeepLink({
				url: currentUrl,
				gifts,
				onConsume: (cleanedUrl) => {
					currentUrl = cleanedUrl;
				},
				onOpen: openGift,
			});

		consumeCurrentMarker();
		currentUrl = new URL('https://prejemesi.cz/w/list-1?gift=gift-2');
		consumeCurrentMarker();

		expect(openGift).toHaveBeenNthCalledWith(1, gifts[0]);
		expect(openGift).toHaveBeenNthCalledWith(2, gifts[1]);
	});

	it('consumes a marker without opening it while another gift dialog is open', () => {
		const onConsume = vi.fn();
		const onOpen = vi.fn();

		consumeGiftDeepLink({
			url: new URL('https://prejemesi.cz/w/list-1?gift=gift-2'),
			gifts,
			canOpen: false,
			onConsume,
			onOpen,
		});

		expect(onConsume).toHaveBeenCalledOnce();
		expect(onOpen).not.toHaveBeenCalled();
	});
});
