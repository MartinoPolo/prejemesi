import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/server', () => ({ getRequestEvent: vi.fn() }));
import { getRequestEvent } from '$app/server';
import {
	assertWishlistScope,
	demoSessionId,
	isPreparedDemoImage,
	rejectDemoOperation,
	wishlistScope,
} from './scope.js';

const requestEvent = vi.mocked(getRequestEvent);

describe('demo wishlist boundary', () => {
	beforeEach(() => requestEvent.mockReset());

	it('never treats a normal visitor as an owner of any demo wishlist', () => {
		requestEvent.mockReturnValue({ locals: {} } as ReturnType<typeof getRequestEvent>);
		expect(demoSessionId()).toBeNull();
		expect(() => assertWishlistScope({ demoSessionId: null })).not.toThrow();
		expect(() => assertWishlistScope({ demoSessionId: 'visitor-a' })).toThrow();
		expect(wishlistScope()).toBeDefined();
	});

	it('cannot read another visitor or real wishlist, and blocks external actions', () => {
		requestEvent.mockReturnValue({ locals: { demoSession: { id: 'visitor-a' } } } as ReturnType<
			typeof getRequestEvent
		>);
		expect(demoSessionId()).toBe('visitor-a');
		expect(() => assertWishlistScope({ demoSessionId: 'visitor-a' })).not.toThrow();
		expect(() => assertWishlistScope({ demoSessionId: 'visitor-b' })).toThrow();
		expect(() => assertWishlistScope({ demoSessionId: null })).toThrow();
		expect(() => rejectDemoOperation()).toThrow();
	});

	it('allows only exact reviewed image assets, never arbitrary relative or remote URLs', () => {
		expect(isPreparedDemoImage('/demo/v1/teapot.jpg')).toBe(true);
		expect(isPreparedDemoImage('/demo/playground/batoh.jpg')).toBe(true);
		expect(isPreparedDemoImage(null)).toBe(true);
		expect(isPreparedDemoImage('/demo/v1/../private.jpg')).toBe(false);
		expect(isPreparedDemoImage('/demo/playground/other.jpg')).toBe(false);
		expect(isPreparedDemoImage('https://example.com/demo/v1/teapot.jpg')).toBe(false);
	});

	it('allows normal account actions when no demo context exists', () => {
		requestEvent.mockReturnValue({ locals: {} } as ReturnType<typeof getRequestEvent>);
		expect(() => rejectDemoOperation()).not.toThrow();
	});
});
