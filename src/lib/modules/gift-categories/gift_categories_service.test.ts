import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';

vi.mock('@sveltejs/kit', () => ({
	error: vi.fn((status: number, message: string) => {
		const err = new Error(message) as Error & { status: number };
		err.status = status;
		throw err;
	}),
}));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn((...args: unknown[]) => args),
	and: vi.fn((...args: unknown[]) => args),
	isNull: vi.fn((arg: unknown) => arg),
	inArray: vi.fn((...args: unknown[]) => args),
	sql: Object.assign(
		vi.fn(() => ({ as: vi.fn(() => ({})) })),
		{
			join: vi.fn(() => ({})),
		},
	),
}));

vi.mock('$lib/server/db/gift.schema.js', () => ({
	gift: {
		id: 'gift.id',
		wishlistId: 'gift.wishlistId',
		categoryId: 'gift.categoryId',
		deletedAt: 'gift.deletedAt',
		editedAfterShareAt: 'gift.editedAfterShareAt',
		preEditShareSnapshot: 'gift.preEditShareSnapshot',
		updatedAt: 'gift.updatedAt',
	},
	giftCategory: {
		id: 'giftCategory.id',
		wishlistId: 'giftCategory.wishlistId',
		presetKey: 'giftCategory.presetKey',
		customLabel: 'giftCategory.customLabel',
		sortOrder: 'giftCategory.sortOrder',
		deletedAt: 'giftCategory.deletedAt',
		createdAt: 'giftCategory.createdAt',
		updatedAt: 'giftCategory.updatedAt',
	},
}));

vi.mock('$lib/server/db/wishlist.schema.js', () => ({
	wishlist: {
		id: 'wishlist.id',
		sharedAt: 'wishlist.sharedAt',
	},
}));

interface MockDb {
	db: Record<string | symbol, unknown>;
	calls: { method: string; args: unknown[] }[];
	pushResult: (result: unknown[]) => void;
	reset: () => void;
}

function createMockDb(): MockDb {
	const results: unknown[][] = [];
	const calls: { method: string; args: unknown[] }[] = [];
	const indexRef = { value: 0 };

	const chain: Record<string | symbol, unknown> = new Proxy(
		{},
		{
			get(_target, prop) {
				if (prop === 'then') {
					const result = results[indexRef.value] ?? [];
					indexRef.value++;
					return (resolve: (value: unknown[]) => unknown) => resolve(result);
				}
				if (prop === 'transaction') {
					return vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
						calls.push({ method: 'transaction', args: [] });
						return callback(chain);
					});
				}
				return vi.fn((...args: unknown[]) => {
					if (typeof prop === 'string') {
						calls.push({ method: prop, args });
					}
					return chain;
				});
			},
		},
	);

	return {
		db: chain,
		calls,
		pushResult: (result) => results.push(result),
		reset: () => {
			results.length = 0;
			calls.length = 0;
			indexRef.value = 0;
		},
	};
}

const mockDbInstance = createMockDb();

vi.mock('$lib/server/db/index.js', () => ({
	getDb: vi.fn(() => mockDbInstance.db),
}));

const { deleteCustomGiftCategory, renameCustomGiftCategory, resolveImportGiftCategoryAssignments } =
	await import('./gift_categories_service.js');

const WISHLIST_ID = 'wishlist-1';
const CATEGORY_ID = 'category-1';

const customCategory = {
	id: CATEGORY_ID,
	wishlistId: WISHLIST_ID,
	presetKey: null,
	customLabel: 'Sport',
	sortOrder: 0,
	deletedAt: null,
	createdAt: new Date('2024-01-01T00:00:00Z'),
	updatedAt: new Date('2024-01-01T00:00:00Z'),
};

beforeEach(() => {
	mockDbInstance.reset();
	vi.clearAllMocks();
});

describe('gift category management service', () => {
	it('blocks deleting a custom category while active gifts use it', async () => {
		mockDbInstance.pushResult([customCategory]);
		mockDbInstance.pushResult([{ count: 2 }]);

		await expect(deleteCustomGiftCategory(CATEGORY_ID)).rejects.toMatchObject({
			status: 400,
			message: SERVER_ERROR.GIFT_CATEGORY_IN_USE,
		});

		expect(mockDbInstance.calls.filter((call) => call.method === 'update')).toHaveLength(0);
	});

	it('marks assigned gifts edited when a used custom category is renamed after sharing', async () => {
		mockDbInstance.pushResult([customCategory]);
		mockDbInstance.pushResult([customCategory]);
		mockDbInstance.pushResult([]);
		mockDbInstance.pushResult([{ sharedAt: new Date('2024-02-01T00:00:00Z') }]);
		mockDbInstance.pushResult([]);

		await renameCustomGiftCategory({ categoryId: CATEGORY_ID, label: 'Sportovní vybavení' });

		const setCalls = mockDbInstance.calls.filter((call) => call.method === 'set');
		expect(setCalls[0]?.args[0]).toMatchObject({ customLabel: 'Sportovní vybavení' });
		expect(setCalls[1]?.args[0]).toMatchObject({ preEditShareSnapshot: null });
		expect(
			(setCalls[1]?.args[0] as { editedAfterShareAt?: unknown }).editedAfterShareAt,
		).toBeInstanceOf(Date);
	});

	it('creates explicitly resolved custom import categories inside the caller transaction', async () => {
		mockDbInstance.pushResult([]);
		mockDbInstance.pushResult([{ maxSort: 3 }]);
		mockDbInstance.pushResult([
			{
				...customCategory,
				id: 'category-created',
				customLabel: 'Outdoor',
				sortOrder: 4,
			},
		]);

		const resolved = await resolveImportGiftCategoryAssignments({
			database: mockDbInstance.db as never,
			wishlistId: WISHLIST_ID,
			drafts: [
				{
					name: 'Stan',
					description: null,
					links: [],
					price: null,
					currency: 'CZK',
					imageUrl: null,
					quantity: 1,
					priority: 'medium',
					categoryId: null,
					importedCategoryLabel: 'Outdoor',
				},
			],
			resolutions: [{ action: 'create-custom', sourceLabel: 'Outdoor', label: 'Outdoor' }],
		});

		expect(resolved.get('Outdoor')).toBe('category-created');
		const valuesCall = mockDbInstance.calls.find((call) => call.method === 'values');
		expect(valuesCall?.args[0]).toMatchObject({
			wishlistId: WISHLIST_ID,
			customLabel: 'Outdoor',
		});
	});
});
