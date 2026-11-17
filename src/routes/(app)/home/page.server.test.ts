import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/modules/wishlists/home_overview_service.js', () => ({
	getHomeOverview: vi.fn(),
}));

import { getHomeOverview } from '$lib/modules/wishlists/home_overview_service.js';
import { load } from './+page.server.js';

const mockGetHomeOverview = vi.mocked(getHomeOverview);

describe('/home server load', () => {
	const overview = {
		recent: [],
		own: { items: [], total: 0 },
		moderated: { items: [], total: 0 },
		followed: { items: [], total: 0 },
	};

	it('loads the overview by the signed-in user id without waiting for the layout', async () => {
		const depends = vi.fn();
		const parent = vi.fn();
		mockGetHomeOverview.mockResolvedValue(overview);

		const result = await load({
			depends,
			parent,
			locals: { session: { id: 'session-123' }, user: { id: 'user-123' } },
		} as unknown as Parameters<typeof load>[0]);

		expect(depends).toHaveBeenCalledWith('app:home-overview');
		expect(parent).not.toHaveBeenCalled();
		expect(mockGetHomeOverview).toHaveBeenCalledWith('user-123');
		expect(result).toEqual({ overview });
	});

	it('lets the layout redirect a signed-out visitor before loading anything', async () => {
		const layoutRedirect = new Error('redirect to sign-in');
		const parent = vi.fn(async () => {
			throw layoutRedirect;
		});
		mockGetHomeOverview.mockClear();

		await expect(
			load({ depends: vi.fn(), parent, locals: { user: null } } as unknown as Parameters<
				typeof load
			>[0]),
		).rejects.toBe(layoutRedirect);
		expect(mockGetHomeOverview).not.toHaveBeenCalled();
	});

	it('defers to the layout when a user has no session, like the layout guard', async () => {
		const layoutRedirect = new Error('redirect to sign-in');
		mockGetHomeOverview.mockClear();

		await expect(
			load({
				depends: vi.fn(),
				parent: vi.fn(async () => {
					throw layoutRedirect;
				}),
				locals: { session: null, user: { id: 'user-123' } },
			} as unknown as Parameters<typeof load>[0]),
		).rejects.toBe(layoutRedirect);
		expect(mockGetHomeOverview).not.toHaveBeenCalled();
	});

	it('fails rather than loading when the layout lets a signed-out visitor through', async () => {
		mockGetHomeOverview.mockClear();

		await expect(
			load({
				depends: vi.fn(),
				parent: vi.fn(async () => ({})),
				locals: { session: null, user: null },
			} as unknown as Parameters<typeof load>[0]),
		).rejects.toMatchObject({ status: 500 });
		expect(mockGetHomeOverview).not.toHaveBeenCalled();
	});
});
