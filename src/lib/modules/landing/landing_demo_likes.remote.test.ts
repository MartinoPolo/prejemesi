import { beforeEach, describe, expect, it, vi } from 'vitest';

const fixtures = vi.hoisted(() => ({
	getRequestEvent: vi.fn(),
	getDb: vi.fn(),
}));

function remoteFunction<T extends (...args: never[]) => unknown>(
	type: 'query' | 'command',
	handler: T,
): T {
	Object.assign(handler, { __: { type } });
	return handler;
}

vi.mock('$app/server', () => ({
	getRequestEvent: fixtures.getRequestEvent,
	query: (handler: () => unknown) => remoteFunction('query', handler),
}));
vi.mock('$lib/server/db/index.js', () => ({ getDb: fixtures.getDb }));
vi.mock('$lib/server/remote.js', () => ({
	publicCommand: (_schema: unknown, handler: (...args: unknown[]) => unknown) =>
		remoteFunction('command', (input: unknown) => handler(null, input)),
	singleFlightRefresh: vi.fn(),
}));
vi.mock('$lib/server/anonymous_visitor.js', () => ({
	getAnonVisitorId: () => null,
	getOrCreateAnonVisitorId: () => null,
}));

import { LANDING_DEMO_GIFT_SLUGS } from './landing_demo_gift_slugs.js';
import { getLandingDemoLikes, toggleLandingDemoLike } from './landing_demo_likes.remote.js';

beforeEach(() => {
	fixtures.getDb.mockReset();
	fixtures.getRequestEvent.mockReset();
});

describe('landing example likes across demo and ordinary visits', () => {
	it('rejects direct reads and writes from a demo visitor on an allowed /home remote page', async () => {
		fixtures.getRequestEvent.mockReturnValue({
			url: new URL('https://prejemesi.cz/home'),
			locals: { demoSession: { id: 'visitor-demo' } },
		});
		await expect(getLandingDemoLikes()).rejects.toMatchObject({ status: 403 });
		await expect(
			toggleLandingDemoLike({ giftSlug: LANDING_DEMO_GIFT_SLUGS[0] }),
		).rejects.toMatchObject({ status: 403 });
		expect(fixtures.getDb).not.toHaveBeenCalled();
	});

	it('continues to serve embedded landing counts outside the playground', async () => {
		fixtures.getRequestEvent.mockReturnValue({
			url: new URL('https://prejemesi.cz/'),
			locals: {},
		});
		fixtures.getDb.mockReturnValue({
			select: () => ({
				from: () => ({
					where: () =>
						Object.assign(Promise.resolve([{ likeCount: 0 }]), {
							groupBy: async () => [],
						}),
				}),
			}),
		});
		await expect(getLandingDemoLikes()).resolves.toMatchObject({ likedSlugs: [] });
		await expect(
			toggleLandingDemoLike({ giftSlug: LANDING_DEMO_GIFT_SLUGS[0] }),
		).resolves.toEqual({
			liked: true,
			likeCount: 0,
		});
		expect(fixtures.getDb).toHaveBeenCalledTimes(2);
	});
});
