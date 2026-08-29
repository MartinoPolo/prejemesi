import { beforeEach, describe, expect, it, vi } from 'vitest';

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
		color: 'giftCategory.color',
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

const {
	getManagedGiftCategorySettingsRows,
	resolveImportGiftCategoryAssignments,
	saveGiftCategorySettings,
} = await import('./gift_categories_service.js');

const WISHLIST_ID = 'wishlist-1';
const CATEGORY_ID = 'category-1';

const customCategory = {
	id: CATEGORY_ID,
	wishlistId: WISHLIST_ID,
	presetKey: null,
	customLabel: 'Sport',
	color: '#0369A1',
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
	it('returns active and soft-deleted presets with their persisted colors', async () => {
		mockDbInstance.pushResult([
			{
				id: 'active-category',
				presetKey: 'books',
				customLabel: null,
				color: '#2563EB',
				sortOrder: 0,
				deletedAt: null,
				usedCount: 2,
			},
			{
				id: 'deleted-preset',
				presetKey: 'games',
				customLabel: null,
				color: '#B91C1C',
				sortOrder: 1,
				deletedAt: new Date('2024-02-01T00:00:00Z'),
				usedCount: 0,
			},
		]);

		await expect(getManagedGiftCategorySettingsRows(WISHLIST_ID)).resolves.toEqual([
			{
				id: 'active-category',
				presetKey: 'books',
				customLabel: null,
				color: '#2563EB',
				sortOrder: 0,
				usedCount: 2,
				enabled: true,
			},
			{
				id: 'deleted-preset',
				presetKey: 'games',
				customLabel: null,
				color: '#B91C1C',
				sortOrder: 1,
				usedCount: 0,
				enabled: false,
			},
		]);
	});

	it('atomically de-assigns active gifts before soft-deleting an omitted custom category', async () => {
		mockDbInstance.pushResult([]); // wishlist lock
		mockDbInstance.pushResult([customCategory]);

		await saveGiftCategorySettings({
			wishlistId: WISHLIST_ID,
			customCategories: [],
			presetKeys: [],
			presetColors: [],
			confirmedRemovalCategoryIds: [CATEGORY_ID],
		});

		const setCalls = mockDbInstance.calls.filter((call) => call.method === 'set');
		expect(setCalls).toHaveLength(2);
		expect(setCalls[0]?.args[0]).toMatchObject({
			categoryId: null,
			updatedAt: expect.any(Date),
		});
		expect(setCalls[1]?.args[0]).toMatchObject({
			deletedAt: expect.any(Date),
			updatedAt: expect.any(Date),
		});
		expect(mockDbInstance.calls.filter((call) => call.method === 'transaction')).toHaveLength(
			1,
		);
		expect(mockDbInstance.calls.filter((call) => call.method === 'for')).toHaveLength(2);
	});

	it('atomically de-assigns active gifts before soft-deleting a disabled preset category', async () => {
		const presetCategory = {
			...customCategory,
			id: 'preset-category',
			presetKey: 'books',
			customLabel: null,
		};
		mockDbInstance.pushResult([]); // wishlist lock
		mockDbInstance.pushResult([presetCategory]);

		await saveGiftCategorySettings({
			wishlistId: WISHLIST_ID,
			customCategories: [],
			presetKeys: [],
			presetColors: [],
			confirmedRemovalCategoryIds: [presetCategory.id],
		});

		const setCalls = mockDbInstance.calls.filter((call) => call.method === 'set');
		expect(setCalls).toHaveLength(2);
		expect(setCalls[0]?.args[0]).toMatchObject({
			categoryId: null,
			updatedAt: expect.any(Date),
		});
		expect(setCalls[1]?.args[0]).toMatchObject({ deletedAt: expect.any(Date) });
	});

	it.each([
		['missing', []],
		['extraneous', [CATEGORY_ID, 'category-other']],
		['duplicate', [CATEGORY_ID, CATEGORY_ID]],
	])('rejects %s removal confirmations before changing gifts', async (_case, confirmations) => {
		mockDbInstance.pushResult([]); // wishlist lock
		mockDbInstance.pushResult([customCategory]);

		await expect(
			saveGiftCategorySettings({
				wishlistId: WISHLIST_ID,
				customCategories: [],
				presetKeys: [],
				presetColors: [],
				confirmedRemovalCategoryIds: confirmations,
			}),
		).rejects.toThrow('GIFT_CATEGORY_REMOVAL_CONFIRMATION_MISMATCH');
		expect(mockDbInstance.calls.filter((call) => call.method === 'set')).toHaveLength(0);
	});

	it('serializes rename without marking assigned gifts edited after share', async () => {
		mockDbInstance.pushResult([]); // wishlist lock
		mockDbInstance.pushResult([customCategory]);
		await saveGiftCategorySettings({
			wishlistId: WISHLIST_ID,
			customCategories: [{ id: CATEGORY_ID, label: 'Sportovní vybavení', color: '#0369A1' }],
			presetKeys: [],
			presetColors: [],
			confirmedRemovalCategoryIds: [],
		});

		const setCalls = mockDbInstance.calls.filter((call) => call.method === 'set');
		expect(setCalls).toHaveLength(3);
		expect(setCalls[1]?.args[0]).toMatchObject({ customLabel: 'Sportovní vybavení' });
		for (const call of setCalls) {
			expect(call.args[0]).not.toHaveProperty('editedAfterShareAt');
		}
		expect(mockDbInstance.calls.filter((call) => call.method === 'for')).toHaveLength(2);
	});

	it('restores a soft-deleted preset with the same-save color override', async () => {
		const presetCategory = {
			...customCategory,
			id: 'preset-category',
			presetKey: 'books',
			customLabel: null,
			color: '#b91c1c',
			deletedAt: new Date('2024-02-01T00:00:00Z'),
		};
		mockDbInstance.pushResult([]); // wishlist lock
		mockDbInstance.pushResult([presetCategory]);

		await saveGiftCategorySettings({
			wishlistId: WISHLIST_ID,
			customCategories: [],
			presetKeys: ['books'],
			presetColors: [{ key: 'books', color: '#2563EB' }],
			confirmedRemovalCategoryIds: [],
		});

		const setValues = mockDbInstance.calls
			.filter((call) => call.method === 'set')
			.map((call) => call.args[0] as Record<string, unknown>);
		expect(setValues).toContainEqual(
			expect.objectContaining({
				deletedAt: null,
				color: '#2563EB',
				updatedAt: expect.any(Date),
			}),
		);
	});

	it('moves retained custom labels aside before applying an atomic label swap', async () => {
		const firstCategory = { ...customCategory, customLabel: 'Kategorie Alfa' };
		const secondCategory = {
			...customCategory,
			id: 'category-2',
			customLabel: 'Kategorie Beta',
			sortOrder: 1,
		};
		mockDbInstance.pushResult([]); // wishlist lock
		mockDbInstance.pushResult([firstCategory, secondCategory]);

		await saveGiftCategorySettings({
			wishlistId: WISHLIST_ID,
			customCategories: [
				{ id: CATEGORY_ID, label: 'Kategorie Beta', color: '#0369A1' },
				{ id: secondCategory.id, label: 'Kategorie Alfa', color: '#047857' },
			],
			presetKeys: [],
			presetColors: [],
			confirmedRemovalCategoryIds: [],
		});

		const labels = mockDbInstance.calls
			.filter((call) => call.method === 'set')
			.map((call) => (call.args[0] as { customLabel?: string }).customLabel)
			.filter((label): label is string => label !== undefined);
		expect(labels).toHaveLength(4);
		expect(labels.slice(0, 2)).toEqual([
			expect.stringMatching(/^__category_reconcile_/),
			expect.stringMatching(/^__category_reconcile_/),
		]);
		expect(labels.slice(2)).toEqual(['Kategorie Beta', 'Kategorie Alfa']);
		expect(mockDbInstance.calls.filter((call) => call.method === 'transaction')).toHaveLength(
			1,
		);
	});

	it('creates explicitly resolved custom import categories inside the caller transaction', async () => {
		mockDbInstance.pushResult([]); // active label conflict lookup
		mockDbInstance.pushResult(
			Array.from({ length: 8 }, (_, index) => ({ id: `existing-${index}` })),
		); // palette wraps after eight persisted custom categories
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
			color: '#0369A1',
		});
	});
});
