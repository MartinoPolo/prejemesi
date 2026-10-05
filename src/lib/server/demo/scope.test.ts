import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/server', () => ({ getRequestEvent: vi.fn() }));
import { getRequestEvent } from '$app/server';
import {
	assertWishlistScope,
	demoSessionId,
	isPreparedDemoImage,
	rejectDemoOperation,
} from './scope.js';

const requestEvent = vi.mocked(getRequestEvent);

function thrownBy(operation: () => void): unknown {
	try {
		operation();
	} catch (failure) {
		return failure;
	}
	throw new Error('Expected the operation to throw');
}

describe('demo wishlist boundary', () => {
	beforeEach(() => requestEvent.mockReset());

	it('never treats a normal visitor as an owner of any demo wishlist', () => {
		requestEvent.mockReturnValue({ locals: {} } as ReturnType<typeof getRequestEvent>);
		expect(demoSessionId()).toBeNull();
		expect(() => assertWishlistScope({ demoSessionId: null })).not.toThrow();
		expect(thrownBy(() => assertWishlistScope({ demoSessionId: 'visitor-a' }))).toMatchObject({
			status: 404,
		});
	});

	it('cannot read another visitor or real wishlist, and blocks external actions', () => {
		requestEvent.mockReturnValue({ locals: { demoSession: { id: 'visitor-a' } } } as ReturnType<
			typeof getRequestEvent
		>);
		expect(demoSessionId()).toBe('visitor-a');
		expect(() => assertWishlistScope({ demoSessionId: 'visitor-a' })).not.toThrow();
		expect(thrownBy(() => assertWishlistScope({ demoSessionId: 'visitor-b' }))).toMatchObject({
			status: 404,
		});
		expect(thrownBy(() => assertWishlistScope({ demoSessionId: null }))).toMatchObject({
			status: 404,
		});
		expect(thrownBy(() => rejectDemoOperation())).toMatchObject({ status: 403 });
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
