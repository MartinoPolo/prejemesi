import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import type {
	ManagedGiftCategory,
	PublicGiftCategory,
} from '$lib/modules/gift-categories/types.js';

// Issue #519: “Vytvořit kategorii” opens a quick-add dialog (name and color) with the
// settings validation; confirming creates and assigns in one step, cancelling changes nothing,
// and in the gift editor the new category only becomes the draft selection.

const remoteMocks = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock('$env/dynamic/public', () => ({ env: { PUBLIC_R2_URL: '/' } }));
vi.mock('$lib/modules/gift-categories/gift_categories.remote.js', () => ({
	createGiftCategoryCommand: remoteMocks.create,
}));

const { default: GiftCategoryQuickAddDialog } = await import('./GiftCategoryQuickAddDialog.svelte');
const { default: GiftDetailForm } = await import('./GiftDetailForm.svelte');

const existingCategories: ManagedGiftCategory[] = [
	{
		id: 'lego',
		presetKey: null,
		customLabel: 'Lego',
		color: '#2563EB',
		sortOrder: 0,
		usedCount: 0,
	},
];

const createdCategory: PublicGiftCategory = {
	id: 'board-games',
	presetKey: null,
	customLabel: 'Deskovky',
	color: '#0F766E',
	sortOrder: 1,
};

afterEach(() => {
	remoteMocks.create.mockReset();
});

describe('category quick-add dialog', () => {
	it('creates the named category for the acting gifts in one confirmation', async () => {
		remoteMocks.create.mockResolvedValue(createdCategory);
		const oncreated = vi.fn();
		const screen = await render(GiftCategoryQuickAddDialog, {
			props: {
				open: true,
				wishlistId: 'wishlist-1',
				target: { kind: 'gifts', giftIds: ['gift-1', 'gift-2'] },
				categories: existingCategories,
				oncreated,
			},
		});

		await screen
			.getByRole('textbox', { name: m.gift_category_quick_add_name_label() })
			.fill('  Deskovky ');
		await screen.getByRole('button', { name: m.gift_category_quick_add_submit() }).click();

		await expect.poll(() => oncreated).toHaveBeenCalledWith(createdCategory);
		expect(remoteMocks.create).toHaveBeenCalledOnce();
		expect(remoteMocks.create).toHaveBeenCalledWith(
			expect.objectContaining({
				wishlistId: 'wishlist-1',
				label: 'Deskovky',
				giftIds: ['gift-1', 'gift-2'],
				color: expect.stringMatching(/^#[0-9A-F]{6}$/i),
			}),
		);
		await expect.element(screen.getByTestId('gift-category-quick-add')).not.toBeInTheDocument();
		await screen.unmount();
	});

	it('rejects a name an enabled category uses in either language, like category settings do', async () => {
		const booksPreset: ManagedGiftCategory = {
			id: 'books',
			presetKey: 'books',
			customLabel: null,
			color: '#2563EB',
			sortOrder: 1,
			usedCount: 0,
		};
		const screen = await render(GiftCategoryQuickAddDialog, {
			props: {
				open: true,
				wishlistId: 'wishlist-1',
				target: { kind: 'gifts', giftIds: ['gift-1'], giftName: 'Kolo' },
				categories: [...existingCategories, booksPreset],
			},
		});
		const name = screen.getByRole('textbox', { name: m.gift_category_quick_add_name_label() });
		const submit = screen.getByRole('button', { name: m.gift_category_quick_add_submit() });

		for (const duplicate of ['lego', 'Knihy', 'Books']) {
			await name.fill(duplicate);
			await expect
				.element(screen.getByText(m.server_error_gift_category_label_conflict()))
				.toBeInTheDocument();
			await expect.element(submit).toBeDisabled();
		}
		// Issue #534: a preset name is free once the wishlist no longer has that preset.
		await name.fill('Hry');
		await expect
			.element(screen.getByText(m.server_error_gift_category_label_conflict()))
			.not.toBeInTheDocument();
		await expect.element(submit).toBeEnabled();
		await name.fill('');
		await expect.element(submit).toBeDisabled();
		expect(remoteMocks.create).not.toHaveBeenCalled();
		await screen.unmount();
	});

	it('changes nothing when cancelled', async () => {
		const oncreated = vi.fn();
		const screen = await render(GiftCategoryQuickAddDialog, {
			props: {
				open: true,
				wishlistId: 'wishlist-1',
				target: { kind: 'gifts', giftIds: ['gift-1'], giftName: 'Kolo' },
				categories: existingCategories,
				oncreated,
			},
		});
		await screen
			.getByRole('textbox', { name: m.gift_category_quick_add_name_label() })
			.fill('Deskovky');
		await screen.getByRole('button', { name: m.cancel() }).click();

		await expect.element(screen.getByTestId('gift-category-quick-add')).not.toBeInTheDocument();
		expect(remoteMocks.create).not.toHaveBeenCalled();
		expect(oncreated).not.toHaveBeenCalled();
		await screen.unmount();
	});

	it('mentions hidden gifts that the bulk assignment includes', async () => {
		const screen = await render(GiftCategoryQuickAddDialog, {
			props: {
				open: true,
				wishlistId: 'wishlist-1',
				target: { kind: 'gifts', giftIds: ['gift-1', 'gift-2', 'gift-3'], hiddenCount: 2 },
				categories: existingCategories,
			},
		});
		await expect
			.element(screen.getByText(m.gift_category_quick_add_hidden({ count: 2 })))
			.toBeInTheDocument();
		await screen.unmount();
	});
});

describe('gift editor category select', () => {
	const formProps = {
		mode: 'create' as const,
		gift: null,
		wishlistId: 'wishlist-1',
		priorityLevels: [],
		role: 'recipient' as const,
		postShareLocked: false,
		canDelete: false,
		isSubmitting: false,
		isDeleting: false,
		categoryOptions: existingCategories,
	};

	it('selects the created category in the draft and saves it with the gift', async () => {
		remoteMocks.create.mockResolvedValue(createdCategory);
		const oncreate = vi.fn();
		const screen = await render(GiftDetailForm, {
			...formProps,
			canCreateCategory: true,
			oncreate,
		});

		await screen.getByRole('textbox', { name: m.gift_name_label() }).fill('Catan');
		await screen.getByTestId('gift-category-select').click();
		const options = screen.getByRole('option');
		await expect.element(options.last()).toHaveTextContent(m.gift_category_create());
		await options.last().click();
		await screen
			.getByRole('textbox', { name: m.gift_category_quick_add_name_label() })
			.fill('Deskovky');
		await screen
			.getByTestId('gift-category-quick-add')
			.getByRole('button', { name: m.gift_category_create() })
			.click();

		await expect
			.poll(() => remoteMocks.create)
			.toHaveBeenCalledWith(expect.objectContaining({ giftIds: [], label: 'Deskovky' }));
		await expect
			.element(screen.getByTestId('gift-category-select'))
			.toHaveTextContent('Deskovky');
		expect(oncreate).not.toHaveBeenCalled();

		await screen.getByRole('button', { name: m.gift_add_title() }).first().click();
		expect(oncreate).toHaveBeenCalledWith(
			expect.objectContaining({ categoryId: createdCategory.id }),
		);
		await screen.unmount();
	});

	it('offers no Create category without category-management rights', async () => {
		const screen = await render(GiftDetailForm, formProps);
		await screen.getByTestId('gift-category-select').click();
		await expect.element(screen.getByRole('option', { name: 'Lego' })).toBeInTheDocument();
		expect(screen.getByRole('option', { name: m.gift_category_create() }).query()).toBeNull();
		await screen.unmount();
	});
});
