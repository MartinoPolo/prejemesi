import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import { GIFT_CATEGORY_PRESETS } from '$lib/modules/gift-categories/types.js';
import type { ManagedGiftCategory } from '$lib/modules/gift-categories/types.js';

const remoteMocks = vi.hoisted(() => ({
	categories: [] as ManagedGiftCategory[],
	save: vi.fn(),
}));

vi.mock('$env/dynamic/public', () => ({ env: {} }));
vi.mock('$lib/modules/gift-categories/gift_categories.remote.js', () => ({
	getGiftCategories: vi.fn(() => ({ current: remoteMocks.categories })),
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

	it('keeps a used custom category staged after cancellation and removes it only after confirmation', async () => {
		remoteMocks.categories = [category({ customLabel: 'Sport', usedCount: 2 })];
		const screen = render(WishlistCategorySettings, { wishlistId: 'wishlist-1' });

		await screen.getByRole('button', { name: m.delete() }).click();
		const dialog = page.getByRole('dialog');
		await expect.element(dialog).toBeVisible();
		expect(dialog.element().textContent).toContain('Sport');
		expect(dialog.element().textContent).toContain('2');
		await dialog.getByRole('button', { name: m.cancel() }).click();
		expect(findInput('Sport')).toBeDefined();

		await screen.getByRole('button', { name: m.delete() }).click();
		await dialog.getByTestId('gift-category-remove-confirm').click();
		await vi.waitFor(() => expect(findInput('Sport')).toBeUndefined());
		expect(remoteMocks.save).not.toHaveBeenCalled();
	});

	it('does not stage disabling a used preset until its confirmation is accepted', async () => {
		remoteMocks.categories = [
			category({ presetKey: preset.key, customLabel: null, usedCount: 4 }),
		];
		const screen = render(WishlistCategorySettings, { wishlistId: 'wishlist-1' });
		const checkbox = screen.getByRole('checkbox', { name: preset.labels.cs });

		await checkbox.click();
		await page.getByRole('dialog').getByRole('button', { name: m.cancel() }).click();
		await expect.element(checkbox).toBeChecked();
		await checkbox.click();
		await page.getByTestId('gift-category-remove-confirm').click();
		await expect.element(checkbox).not.toBeChecked();
		expect(remoteMocks.save).not.toHaveBeenCalled();
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
