import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@sveltejs/kit/internal', () => ({ init_remote_functions: vi.fn() }));
vi.mock('$app/server', () => ({
	command: vi.fn((...args: unknown[]) => args.at(-1)),
	query: vi.fn((...args: unknown[]) => args.at(-1)),
}));

function marked(handler: (...args: never[]) => unknown) {
	Object.assign(handler, { __: {} });
	return handler;
}

const singleFlightRefresh = vi.fn();
vi.mock('$lib/server/remote.js', () => ({
	guardedCommand: vi.fn((_schema: unknown, handler: (...args: never[]) => unknown) =>
		marked(handler),
	),
	guardedQueryWithArgs: vi.fn((_schema: unknown, handler: (...args: never[]) => unknown) =>
		marked(handler),
	),
	singleFlightRefresh,
}));

const verifyManagerAccess = vi.fn();
const assertWishlistMutable = vi.fn();
vi.mock('$lib/modules/wishlists/wishlist_access.js', () => ({
	verifyManagerAccess,
	assertWishlistMutable,
}));

const saveGiftCategorySettings = vi.fn();
vi.mock('./gift_categories_service.js', () => ({
	getManagedGiftCategories: vi.fn(),
	getManagedGiftCategorySettingsRows: vi.fn(),
	saveGiftCategorySettings,
}));
vi.mock('./types.js', () => ({ SaveGiftCategorySettingsInputSchema: {} }));

const getGiftsByWishlistShortId = vi.fn();
Object.assign(getGiftsByWishlistShortId, { __: {} });
vi.mock('$lib/modules/gifts/gifts.remote.js', () => ({ getGiftsByWishlistShortId }));

const { getGiftCategories, getGiftCategorySettingsRows, saveGiftCategorySettingsCommand } =
	await import('./gift_categories.remote.js');

function deferred() {
	let resolve!: () => void;
	const promise = new Promise<void>((settle) => (resolve = settle));
	return { promise, resolve };
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe('gift category remote commands', () => {
	it('awaits every server-driven refresh after persistence', async () => {
		const wishlistRow = { shortId: 'short-1' };
		const input = {
			wishlistId: 'wishlist-1',
			customCategories: [],
			presetKeys: [],
			presetColors: [],
			confirmedRemovalCategoryIds: [],
		};
		verifyManagerAccess.mockResolvedValue({ wishlistRow });
		saveGiftCategorySettings.mockResolvedValue(undefined);
		const categoryRefresh = deferred();
		const settingsRefresh = deferred();
		const giftsRefresh = deferred();
		singleFlightRefresh
			.mockReturnValueOnce(categoryRefresh.promise)
			.mockReturnValueOnce(settingsRefresh.promise)
			.mockReturnValueOnce(giftsRefresh.promise);

		let settled = false;
		const command = (saveGiftCategorySettingsCommand as unknown as Function)(
			{ user: { id: 'user-1' } },
			input,
		).then(() => (settled = true));
		await vi.waitFor(() => expect(singleFlightRefresh).toHaveBeenCalledTimes(3));

		expect(saveGiftCategorySettings).toHaveBeenCalledWith(input);
		expect(singleFlightRefresh).toHaveBeenNthCalledWith(1, getGiftCategories, 'wishlist-1');
		expect(singleFlightRefresh).toHaveBeenNthCalledWith(
			2,
			getGiftCategorySettingsRows,
			'wishlist-1',
		);
		expect(singleFlightRefresh).toHaveBeenNthCalledWith(
			3,
			getGiftsByWishlistShortId,
			'short-1',
		);
		expect(settled).toBe(false);
		categoryRefresh.resolve();
		settingsRefresh.resolve();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(settled).toBe(false);
		giftsRefresh.resolve();
		await command;
		expect(settled).toBe(true);
	});
});
