import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import type { ManagedGiftCategory } from '$lib/modules/gift-categories/types.js';
import { giftCategoryColorForIndex } from '$lib/modules/gift-categories/gift_category_colors.js';

const remoteMocks = vi.hoisted(() => ({
	categories: [] as ManagedGiftCategory[],
	refresh: vi.fn(),
	save: vi.fn(),
}));

vi.mock('$env/dynamic/public', () => ({ env: {} }));
vi.mock('$lib/modules/gift-categories/gift_category_queries.remote.js', () => ({
	getGiftCategories: vi.fn(() => ({
		get current() {
			return remoteMocks.categories;
		},
		refresh: remoteMocks.refresh,
	})),
}));
vi.mock('$lib/modules/gift-categories/gift_categories.remote.js', () => ({
	saveGiftCategorySettingsCommand: remoteMocks.save,
}));

const { default: WishlistCategorySettings } = await import('./WishlistCategorySettings.svelte');

function category(overrides: Partial<ManagedGiftCategory>): ManagedGiftCategory {
	return {
		id: 'category-1',
		presetKey: null,
		customLabel: 'Sport',
		color: '#0369A1',
		sortOrder: 0,
		usedCount: 0,
		...overrides,
	};
}

function normalizeColor(value: string): string {
	const probe = document.createElement('div');
	probe.style.color = value;
	document.body.appendChild(probe);
	const normalized = getComputedStyle(probe).color;
	probe.remove();
	return normalized;
}

function rowBadge(label: string): HTMLElement {
	return document.querySelector<HTMLElement>(
		`[data-category-row][data-category-label="${label}"] [data-testid="gift-category-badge"]`,
	)!;
}

function colorTrigger(label: string) {
	return page.getByRole('button', { name: m.gift_category_color_label({ category: label }) });
}

async function setColorDraft(dialog: ReturnType<typeof page.getByRole>, value: string) {
	const textbox = dialog.getByRole('textbox', { name: m.color_picker_hex_label() });
	const textboxElement = textbox.element();
	if (!(textboxElement instanceof HTMLInputElement)) {
		throw new TypeError('Expected the color picker textbox to be an HTMLInputElement');
	}

	textboxElement.value = value;
	textboxElement.dispatchEvent(
		new InputEvent('input', { inputType: 'insertText', data: value, bubbles: true }),
	);

	await expect.element(textbox).toHaveValue(value);
	await expect.element(dialog.getByRole('button', { name: m.save() })).toBeEnabled();
}

async function addCategory(label: string) {
	const input = page.getByRole('textbox', { name: m.gift_category_quick_add_name_label() });
	if (input.elements().length === 0) {
		await page.getByRole('button', { name: m.gift_category_new() }).click();
	}
	await input.fill(label);
	await page.getByRole('button', { name: m.gift_category_add() }).click();
	await expect.element(colorTrigger(label)).toBeVisible();
}

beforeEach(() => {
	remoteMocks.refresh.mockReset();
	remoteMocks.refresh.mockResolvedValue(undefined);
	remoteMocks.save.mockReset();
	remoteMocks.save.mockResolvedValue(undefined);
	remoteMocks.categories = [];
});

describe('WishlistCategorySettings colors', () => {
	it('paints each badge and swatch in its category color', async () => {
		remoteMocks.categories = [
			category({ id: 'sport', customLabel: 'Sport', color: '#0369A1' }),
			category({
				id: 'books',
				presetKey: 'books',
				customLabel: null,
				color: '#16A34A',
				sortOrder: 1,
			}),
		];
		render(WishlistCategorySettings, { wishlistId: 'wishlist-1' });

		await expect.element(colorTrigger('Sport')).toBeVisible();
		expect(getComputedStyle(colorTrigger('Sport').element()).backgroundColor).toBe(
			normalizeColor('#0369A1'),
		);
		expect(getComputedStyle(rowBadge('Sport')).backgroundColor).toBe(normalizeColor('#0369A1'));
		const booksLabel =
			document.querySelectorAll<HTMLElement>('[data-category-row]')[1]!.dataset
				.categoryLabel!;
		expect(getComputedStyle(rowBadge(booksLabel)).backgroundColor).toBe(
			normalizeColor('#16A34A'),
		);
	});

	it('previews the staged color as a badge and applies it only after explicit acceptance', async () => {
		remoteMocks.categories = [category({ id: 'sport', customLabel: 'Sport' })];
		render(WishlistCategorySettings, { wishlistId: 'wishlist-1' });
		await expect.element(colorTrigger('Sport')).toBeEnabled();

		await colorTrigger('Sport').click();
		const dialog = page.getByRole('dialog', {
			name: m.gift_category_color_label({ category: 'Sport' }),
		});
		await setColorDraft(dialog, '#B91C1C');
		const previewBadge = dialog
			.getByTestId('color-picker-preview')
			.getByTestId('gift-category-badge');
		await expect.element(previewBadge).toHaveTextContent('Sport');
		expect(getComputedStyle(previewBadge.element()).backgroundColor).toBe(
			normalizeColor('#B91C1C'),
		);
		expect(getComputedStyle(rowBadge('Sport')).backgroundColor).toBe(normalizeColor('#0369A1'));

		await dialog.getByRole('button', { name: m.save() }).click();
		await vi.waitFor(() =>
			expect(getComputedStyle(rowBadge('Sport')).backgroundColor).toBe(
				normalizeColor('#B91C1C'),
			),
		);
		expect(remoteMocks.save).not.toHaveBeenCalled();
		document.querySelector<HTMLFormElement>('#wishlist-categories-form')!.requestSubmit();
		await vi.waitFor(() =>
			expect(remoteMocks.save).toHaveBeenCalledWith({
				wishlistId: 'wishlist-1',
				categories: [{ id: 'sport', label: 'Sport', color: '#B91C1C' }],
				confirmedRemovalCategoryIds: [],
			}),
		);
	});

	it('discards a staged color on Cancel', async () => {
		remoteMocks.categories = [category({ id: 'sport', customLabel: 'Sport' })];
		render(WishlistCategorySettings, { wishlistId: 'wishlist-1' });
		await expect.element(colorTrigger('Sport')).toBeEnabled();

		await colorTrigger('Sport').click();
		const dialog = page.getByRole('dialog', {
			name: m.gift_category_color_label({ category: 'Sport' }),
		});
		await setColorDraft(dialog, '#B91C1C');
		await dialog.getByRole('button', { name: m.cancel() }).click();

		await expect.element(dialog).not.toBeInTheDocument();
		expect(getComputedStyle(rowBadge('Sport')).backgroundColor).toBe(normalizeColor('#0369A1'));
	});

	it('names the color picker after the current category label', async () => {
		remoteMocks.categories = [category({ customLabel: 'Sport' })];
		const screen = render(WishlistCategorySettings, { wishlistId: 'wishlist-1' });
		const rename = screen.getByRole('button', {
			name: m.gift_category_rename_label({ category: 'Sport' }),
		});
		await expect.element(rename).toBeEnabled();

		await rename.click();
		await screen
			.getByRole('textbox', { name: m.gift_category_quick_add_name_label() })
			.fill('Pohyb');
		await userEvent.keyboard('{Enter}');

		await expect.element(colorTrigger('Pohyb')).toBeVisible();
	});

	it('disables every category color trigger while a save is pending', async () => {
		remoteMocks.categories = [
			category({ id: 'sport', customLabel: 'Sport' }),
			category({ id: 'bikes', customLabel: 'Kola', sortOrder: 1 }),
		];
		let finishSave!: () => void;
		remoteMocks.save.mockReturnValue(new Promise<void>((resolve) => (finishSave = resolve)));
		render(WishlistCategorySettings, { wishlistId: 'wishlist-1' });
		await expect.element(colorTrigger('Sport')).toBeEnabled();

		document.querySelector<HTMLFormElement>('#wishlist-categories-form')!.requestSubmit();
		await expect.element(colorTrigger('Sport')).toBeDisabled();
		await expect.element(colorTrigger('Kola')).toBeDisabled();
		finishSave();
	});

	it('gives a new category the next automatic color after the custom ones', async () => {
		remoteMocks.categories = [
			category({ id: 'sport', customLabel: 'Sport' }),
			category({ id: 'books', presetKey: 'books', customLabel: null, sortOrder: 1 }),
		];
		render(WishlistCategorySettings, { wishlistId: 'wishlist-1' });
		await expect
			.element(page.getByRole('button', { name: m.gift_category_new() }))
			.toBeEnabled();

		await page.getByRole('button', { name: m.gift_category_new() }).click();
		const preview = page
			.getByTestId('gift-category-new-preview')
			.getByTestId('gift-category-badge');
		await expect.element(preview).toHaveTextContent(m.gift_category_new());
		expect(getComputedStyle(preview.element()).backgroundColor).toBe(
			normalizeColor(giftCategoryColorForIndex(1)),
		);
		await addCategory('Hudba');

		expect(getComputedStyle(colorTrigger('Hudba').element()).backgroundColor).toBe(
			normalizeColor(giftCategoryColorForIndex(1)),
		);
	});

	it('does not reuse an automatic color after removing an earlier unsaved category', async () => {
		render(WishlistCategorySettings, { wishlistId: 'wishlist-1' });
		await expect
			.element(page.getByRole('button', { name: m.gift_category_new() }))
			.toBeEnabled();

		await addCategory('První');
		await addCategory('Druhá');
		await page
			.getByRole('button', { name: m.gift_category_remove_label({ category: 'První' }) })
			.click();
		await expect.element(colorTrigger('První')).not.toBeInTheDocument();
		await addCategory('Třetí');

		expect(getComputedStyle(colorTrigger('Druhá').element()).backgroundColor).toBe(
			normalizeColor(giftCategoryColorForIndex(1)),
		);
		expect(getComputedStyle(colorTrigger('Třetí').element()).backgroundColor).toBe(
			normalizeColor(giftCategoryColorForIndex(2)),
		);
	});
});
