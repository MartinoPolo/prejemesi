import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import { GIFT_CATEGORY_PRESETS } from '$lib/modules/gift-categories/types.js';
import type { ManagedGiftCategory } from '$lib/modules/gift-categories/types.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';

const remoteMocks = vi.hoisted(() => ({
	categories: [] as ManagedGiftCategory[],
	refresh: vi.fn(),
	save: vi.fn(),
}));

vi.mock('$env/dynamic/public', () => ({ env: {} }));
vi.mock('$lib/modules/gift-categories/gift_categories.remote.js', () => ({
	getGiftCategories: vi.fn(() => ({
		current: remoteMocks.categories,
		refresh: remoteMocks.refresh,
	})),
	saveGiftCategorySettingsCommand: remoteMocks.save,
}));

const { default: WishlistCategorySettings } = await import('./WishlistCategorySettings.svelte');
const preset = GIFT_CATEGORY_PRESETS[0]!;

function findInput(value: string): HTMLInputElement | undefined {
	return [...document.querySelectorAll<HTMLInputElement>('input')].find(
		(input) => input.value === value,
	);
}

function category(overrides: Partial<ManagedGiftCategory>): ManagedGiftCategory {
	return {
		id: 'category-1',
		presetKey: null,
		customLabel: 'Sport',
		sortOrder: 0,
		usedCount: 0,
		...overrides,
	};
}

beforeEach(() => {
	remoteMocks.refresh.mockReset();
	remoteMocks.refresh.mockResolvedValue(undefined);
	remoteMocks.save.mockReset();
	remoteMocks.categories = [];
});

describe('WishlistCategorySettings', () => {
	it('shows a right-aligned compact usage count, including zero, beside every active category', async () => {
		remoteMocks.categories = [
			category({ id: 'custom', customLabel: 'Sport', usedCount: 0 }),
			category({
				id: 'preset',
				presetKey: preset.key,
				customLabel: null,
				sortOrder: 1,
				usedCount: 3,
			}),
		];
		render(WishlistCategorySettings, { wishlistId: 'wishlist-1' });

		const counts = document.querySelectorAll('[data-testid="gift-category-used-count"]');
		expect(counts).toHaveLength(2);
		expect(counts[0]!.textContent).toContain('0');
		expect(counts[1]!.textContent).toContain('3');
		expect(counts[0]!.className).toContain('text-right');
		expect(counts[0]!.parentElement?.querySelector('input')).not.toBeNull();
		expect(counts[1]!.parentElement?.textContent).toContain(preset.labels.cs);
	});

	it('requires confirmation for a persisted custom category even when its fetched usage is zero', async () => {
		remoteMocks.categories = [category({ customLabel: 'Sport', usedCount: 0 })];
		const screen = render(WishlistCategorySettings, { wishlistId: 'wishlist-1' });

		await screen.getByRole('button', { name: m.delete() }).click();
		const dialog = page.getByRole('dialog');
		await expect.element(dialog).toBeVisible();
		expect(dialog.element().textContent).toContain('Sport');
		expect(dialog.element().textContent).toContain('0');
		await dialog.getByRole('button', { name: m.cancel() }).click();
		expect(findInput('Sport')).toBeDefined();

		await screen.getByRole('button', { name: m.delete() }).click();
		await dialog.getByTestId('gift-category-remove-confirm').click();
		await vi.waitFor(() => expect(findInput('Sport')).toBeUndefined());
		expect(remoteMocks.save).not.toHaveBeenCalled();
	});

	it('keeps the persisted preset checkbox mounted and restores its focus after cancel and accept', async () => {
		remoteMocks.categories = [
			category({ presetKey: preset.key, customLabel: null, usedCount: 0 }),
		];
		const screen = render(WishlistCategorySettings, { wishlistId: 'wishlist-1' });
		const checkbox = screen.getByRole('checkbox', { name: preset.labels.cs });
		const checkboxElement = checkbox.element();

		await checkbox.click();
		await page.getByRole('dialog').getByRole('button', { name: m.cancel() }).click();
		await expect.element(checkbox).toBeChecked();
		await vi.waitFor(() => expect(document.activeElement).toBe(checkboxElement));
		expect(checkbox.element()).toBe(checkboxElement);

		await checkbox.click();
		await page.getByTestId('gift-category-remove-confirm').click();
		await expect.element(checkbox).not.toBeChecked();
		await vi.waitFor(() => expect(document.activeElement).toBe(checkboxElement));
		expect(checkbox.element()).toBe(checkboxElement);
		expect(remoteMocks.save).not.toHaveBeenCalled();
	});

	it('sends only confirmed persisted removals and clears them after a successful save', async () => {
		remoteMocks.categories = [category({ customLabel: 'Sport', usedCount: 0 })];
		remoteMocks.save.mockResolvedValue(undefined);
		const screen = render(WishlistCategorySettings, { wishlistId: 'wishlist-1' });

		await screen.getByRole('button', { name: m.delete() }).click();
		await page.getByTestId('gift-category-remove-confirm').click();
		document.querySelector<HTMLFormElement>('#wishlist-categories-form')!.requestSubmit();

		await vi.waitFor(() =>
			expect(remoteMocks.save).toHaveBeenCalledWith({
				wishlistId: 'wishlist-1',
				customCategories: [],
				presetKeys: [],
				confirmedRemovalCategoryIds: ['category-1'],
			}),
		);

		document.querySelector<HTMLFormElement>('#wishlist-categories-form')!.requestSubmit();
		await vi.waitFor(() => expect(remoteMocks.save).toHaveBeenCalledTimes(2));
		expect(remoteMocks.save.mock.calls[1]?.[0]).toMatchObject({
			confirmedRemovalCategoryIds: [],
		});
	});

	it('refreshes and requires fresh confirmation after a concurrent category conflict', async () => {
		remoteMocks.categories = [category({ customLabel: 'Sport', usedCount: 1 })];
		remoteMocks.save.mockRejectedValue(
			new Error(SERVER_ERROR.GIFT_CATEGORY_REMOVAL_CONFIRMATION_MISMATCH),
		);
		const screen = render(WishlistCategorySettings, { wishlistId: 'wishlist-1' });

		await screen.getByRole('button', { name: m.delete() }).click();
		await page.getByTestId('gift-category-remove-confirm').click();
		document.querySelector<HTMLFormElement>('#wishlist-categories-form')!.requestSubmit();

		await vi.waitFor(() => expect(remoteMocks.refresh).toHaveBeenCalledOnce());
		await vi.waitFor(() => expect(findInput('Sport')).toBeDefined());
		remoteMocks.save.mockResolvedValue(undefined);
		await screen.getByRole('button', { name: m.delete() }).click();
		await expect.element(page.getByRole('dialog')).toBeVisible();
	});

	it('creates from the focused input on Enter without submitting the settings form', async () => {
		const screen = render(WishlistCategorySettings, { wishlistId: 'wishlist-1' });
		const input = screen.getByPlaceholder(m.gift_category_custom_placeholder());
		await input.fill('Knihy');
		await input.click();
		await userEvent.keyboard('{Enter}');

		await vi.waitFor(() => expect(findInput('Knihy')).toBeDefined());
		expect(remoteMocks.save).not.toHaveBeenCalled();
	});
});
