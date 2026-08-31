import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/modules/wishlists/home_overview_service.js', () => ({
	getHomeOverview: vi.fn(),
}));

import { getHomeOverview } from '$lib/modules/wishlists/home_overview_service.js';
import { load } from './+page.server.js';

const mockGetHomeOverview = vi.mocked(getHomeOverview);

describe('/home server load', () => {
	it('waits for authenticated parent data and loads the overview directly by user id', async () => {
		const overview = {
			recent: [],
			own: { items: [], total: 0 },
			moderated: { items: [], total: 0 },
			followed: { items: [], total: 0 },
		};
		const depends = vi.fn();
		const parent = vi.fn(async () => ({
			user: { id: 'user-123' },
			unreadNotificationCount: 0,
		}));
		mockGetHomeOverview.mockResolvedValue(overview);

		const result = await load({ depends, parent } as unknown as Parameters<typeof load>[0]);

		expect(depends).toHaveBeenCalledWith('app:home-overview');
		expect(mockGetHomeOverview).toHaveBeenCalledWith('user-123');
		expect(result).toEqual({ overview });
	});
});
