import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPixelAssertions } from '../../../../../tests/helpers/pixel-assertions.mjs';
import * as m from '$lib/paraglide/messages.js';
import { GIFT_CATEGORY_PRESETS, keepsPresetLabel } from '$lib/modules/gift-categories/types.js';
import { overwriteGetLocale } from '$lib/paraglide/runtime.js';
import type { ManagedGiftCategory } from '$lib/modules/gift-categories/types.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';

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
const { expectPixelsNear } = createPixelAssertions(expect);
const books = GIFT_CATEGORY_PRESETS.find((preset) => preset.key === 'books')!;
const toys = GIFT_CATEGORY_PRESETS.find((preset) => preset.key === 'toys')!;

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

function rowLabels(): string[] {
	return [
		...document.querySelectorAll<HTMLElement>(
			'[data-category-row]:not([data-gift-reorder-overlay])',
		),
	].map((row) => row.dataset.categoryLabel ?? '');
}

function submitSettings() {
	document.querySelector<HTMLFormElement>('#wishlist-categories-form')!.requestSubmit();
}

function renderSettings() {
	return render(WishlistCategorySettings, { wishlistId: 'wishlist-1' });
}

beforeEach(() => {
	remoteMocks.refresh.mockReset();
	remoteMocks.refresh.mockResolvedValue(undefined);
	remoteMocks.save.mockReset();
	remoteMocks.save.mockResolvedValue(undefined);
	remoteMocks.categories = [];
});

describe('WishlistCategorySettings list', () => {
	it('shows presets and custom categories as one list in their saved order', async () => {
		remoteMocks.categories = [
			category({ id: 'sport', customLabel: 'Sport', sortOrder: 0 }),
			category({ id: 'books', presetKey: 'books', customLabel: null, sortOrder: 1 }),
			category({ id: 'bikes', customLabel: 'Kola', sortOrder: 2, usedCount: 4 }),
		];
		renderSettings();

		await vi.waitFor(() => expect(rowLabels()).toEqual(['Sport', books.labels.cs, 'Kola']));
		const badges = [...document.querySelectorAll('[data-category-row]')].map((row) =>
			row.querySelector('[data-testid="gift-category-badge"]')?.textContent?.trim(),
		);
		expect(badges).toEqual(['Sport', books.labels.cs, 'Kola']);
		const usage = [
			...document.querySelectorAll('[data-testid="gift-category-used-count"]'),
		].map((element) => element.textContent);
		expect(usage).toEqual([
			m.gift_category_usage_compact({ count: 0 }),
			m.gift_category_usage_compact({ count: 0 }),
			m.gift_category_usage_compact({ count: 4 }),
		]);
		await expect
			.element(page.getByTestId('gift-category-count'))
			.toHaveTextContent(m.gift_categories_count_few({ count: 3 }));
		expect(document.querySelectorAll('[role="checkbox"]')).toHaveLength(0);
	});

	it('explains an empty list above the new-category row', async () => {
		const screen = renderSettings();

		await expect.element(screen.getByText(m.gift_categories_empty())).toBeVisible();
		await expect
			.element(screen.getByRole('button', { name: m.gift_category_new() }))
			.toBeVisible();
		await expect
			.element(page.getByTestId('gift-category-count'))
			.toHaveTextContent(m.gift_categories_count_other({ count: 0 }));
	});

	it('nests the row corners parallel to the controls inside them', async () => {
		remoteMocks.categories = [category({ customLabel: 'Sport' })];
		const screen = renderSettings();
		await expect
			.element(
				screen.getByRole('button', {
					name: m.gift_category_remove_label({ category: 'Sport' }),
				}),
			)
			.toBeEnabled();
		const pixels = (value: string) => Number.parseFloat(value);
		const innerRadiusOf = (style: CSSStyleDeclaration) =>
			Math.max(
				0,
				pixels(style.borderTopLeftRadius) -
					pixels(style.borderTopWidth) -
					pixels(style.paddingTop),
			);

		const rowStyle = getComputedStyle(document.querySelector('[data-category-row]')!);
		expectPixelsNear(
			innerRadiusOf(rowStyle),
			pixels(getComputedStyle(document.documentElement).getPropertyValue('--radius-btn')),
		);

		await screen.getByRole('button', { name: m.gift_category_new() }).click();
		const newRowStyle = getComputedStyle(page.getByTestId('gift-category-new-row').element());
		const nameInput = screen
			.getByRole('textbox', { name: m.gift_category_quick_add_name_label() })
			.element();
		expect(pixels(newRowStyle.borderTopWidth)).toBeGreaterThan(pixels(rowStyle.borderTopWidth));
		expectPixelsNear(
			pixels(newRowStyle.borderTopLeftRadius),
			pixels(rowStyle.borderTopLeftRadius),
		);
		expectPixelsNear(
			pixels(getComputedStyle(nameInput).borderTopLeftRadius),
			innerRadiusOf(newRowStyle),
		);
	});

	it('shows the live order preview beside the list only on wide screens', async () => {
		remoteMocks.categories = [
			category({ id: 'sport', customLabel: 'Sport', usedCount: 2 }),
			category({ id: 'bikes', customLabel: 'Kola', sortOrder: 1 }),
		];
		await page.viewport(1280, 800);
		const screen = renderSettings();
		const preview = page.getByTestId('gift-category-order-preview');

		await expect.element(preview).toBeVisible();
		await expect.element(preview).toHaveTextContent(/Sport.*Kola/);
		await screen
			.getByRole('button', { name: m.gift_category_remove_label({ category: 'Sport' }) })
			.click();
		await expect.element(preview).not.toHaveTextContent('Sport');

		await page.viewport(390, 720);
		await expect.element(preview).not.toBeVisible();
	});

	it('refreshes stale usage before enabling removal and uses the fresh count', async () => {
		remoteMocks.categories = [category({ customLabel: 'Sport', usedCount: 0 })];
		let finishRefresh!: () => void;
		remoteMocks.refresh.mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					finishRefresh = () => {
						remoteMocks.categories = [category({ customLabel: 'Sport', usedCount: 1 })];
						resolve();
					};
				}),
		);
		const screen = renderSettings();
		const remove = screen.getByRole('button', {
			name: m.gift_category_remove_label({ category: 'Sport' }),
		});

		await expect.element(remove).toBeDisabled();
		finishRefresh();
		await expect.element(remove).toBeEnabled();
		await remove.click();

		await expect
			.element(page.getByTestId('gift-category-removal-note'))
			.toHaveTextContent(m.gift_category_removal_staged_one());
	});

	it('keeps category controls disabled after a refresh failure and retries safely', async () => {
		remoteMocks.categories = [category({ customLabel: 'Sport', usedCount: 0 })];
		remoteMocks.refresh
			.mockRejectedValueOnce(new Error('refresh failed'))
			.mockResolvedValueOnce(undefined);
		const screen = renderSettings();
		const remove = screen.getByRole('button', {
			name: m.gift_category_remove_label({ category: 'Sport' }),
		});

		await expect.element(page.getByRole('alert')).toBeVisible();
		await expect.element(remove).toBeDisabled();
		await page.getByRole('button', { name: m.import_wizard_retry() }).click();

		await vi.waitFor(() => expect(remoteMocks.refresh).toHaveBeenCalledTimes(2));
		await expect.element(remove).toBeEnabled();
		expect(page.getByRole('alert').elements()).toHaveLength(0);
	});
});

describe('WishlistCategorySettings rename', () => {
	it('renames from the badge on Enter and returns focus to the badge', async () => {
		remoteMocks.categories = [category({ id: 'sport', customLabel: 'Sport' })];
		const screen = renderSettings();
		const renameButton = screen.getByRole('button', {
			name: m.gift_category_rename_label({ category: 'Sport' }),
		});
		await expect.element(renameButton).toBeEnabled();

		await renameButton.click();
		const input = screen.getByRole('textbox', { name: m.gift_category_quick_add_name_label() });
		await expect.element(input).toHaveFocus();
		await expect.element(input).toHaveValue('Sport');
		await userEvent.keyboard('Cyklistika{Enter}');

		await vi.waitFor(() => expect(rowLabels()).toEqual(['Cyklistika']));
		await expect
			.element(
				screen.getByRole('button', {
					name: m.gift_category_rename_label({ category: 'Cyklistika' }),
				}),
			)
			.toHaveFocus();
		submitSettings();
		await vi.waitFor(() =>
			expect(remoteMocks.save).toHaveBeenCalledWith({
				wishlistId: 'wishlist-1',
				categories: [{ id: 'sport', label: 'Cyklistika', color: '#0369A1' }],
				confirmedRemovalCategoryIds: [],
			}),
		);
	});

	it('keeps a rename on blur and reverts it on Escape or when emptied', async () => {
		remoteMocks.categories = [category({ id: 'sport', customLabel: 'Sport' })];
		const screen = renderSettings();
		const input = screen.getByRole('textbox', { name: m.gift_category_quick_add_name_label() });
		const renameSport = screen.getByRole('button', {
			name: m.gift_category_rename_label({ category: 'Sport' }),
		});
		await expect.element(renameSport).toBeEnabled();

		await renameSport.click();
		await input.fill('Fotbal');
		await userEvent.keyboard('{Escape}');
		await expect.element(input).not.toBeInTheDocument();
		expect(rowLabels()).toEqual(['Sport']);

		await renameSport.click();
		await input.fill('   ');
		await userEvent.keyboard('{Enter}');
		await expect.element(input).not.toBeInTheDocument();
		expect(rowLabels()).toEqual(['Sport']);

		await renameSport.click();
		await input.fill('Fotbal');
		input.element().blur();
		await vi.waitFor(() => expect(rowLabels()).toEqual(['Fotbal']));
	});

	it('keeps editing with an inline error when the new name matches another category', async () => {
		remoteMocks.categories = [
			category({ id: 'sport', customLabel: 'Sport' }),
			category({ id: 'books', presetKey: 'books', customLabel: null, sortOrder: 1 }),
		];
		const screen = renderSettings();
		const renameSport = screen.getByRole('button', {
			name: m.gift_category_rename_label({ category: 'Sport' }),
		});
		await expect.element(renameSport).toBeEnabled();

		await renameSport.click();
		const input = screen.getByRole('textbox', { name: m.gift_category_quick_add_name_label() });
		await input.fill(books.labels.en.toUpperCase());
		await userEvent.keyboard('{Enter}');

		await expect
			.element(screen.getByText(m.server_error_gift_category_label_conflict()))
			.toBeVisible();
		await expect.element(input).toHaveFocus();
		await expect.element(input).toHaveAttribute('aria-invalid', 'true');
		expect(rowLabels()).toEqual(['Sport', books.labels.cs]);
	});

	it('sends a renamed preset under its new name and an untouched preset under its locale name', async () => {
		remoteMocks.categories = [
			category({ id: 'books', presetKey: 'books', customLabel: null, color: '#2563EB' }),
			category({
				id: 'toys',
				presetKey: 'toys',
				customLabel: null,
				color: '#D97706',
				sortOrder: 1,
			}),
		];
		const screen = renderSettings();
		const renameBooks = screen.getByRole('button', {
			name: m.gift_category_rename_label({ category: books.labels.cs }),
		});
		await expect.element(renameBooks).toBeEnabled();

		await renameBooks.click();
		await screen
			.getByRole('textbox', { name: m.gift_category_quick_add_name_label() })
			.fill('Komiksy');
		await userEvent.keyboard('{Enter}');
		submitSettings();

		await vi.waitFor(() =>
			expect(remoteMocks.save).toHaveBeenCalledWith({
				wishlistId: 'wishlist-1',
				categories: [
					{ id: 'books', label: 'Komiksy', color: '#2563EB' },
					{ id: 'toys', label: toys.labels.cs, color: '#D97706' },
				],
				confirmedRemovalCategoryIds: [],
			}),
		);
	});

	it('sends untouched presets under their English label in English, so they stay presets', async () => {
		overwriteGetLocale(() => 'en');
		try {
			remoteMocks.categories = [
				category({ id: 'books', presetKey: 'books', customLabel: null, color: '#2563EB' }),
				category({ id: 'sport', customLabel: 'Sport', color: '#0369A1', sortOrder: 1 }),
				category({
					id: 'toys',
					presetKey: 'toys',
					customLabel: null,
					color: '#D97706',
					sortOrder: 2,
				}),
			];
			const screen = renderSettings();
			await vi.waitFor(() =>
				expect(rowLabels()).toEqual([books.labels.en, 'Sport', toys.labels.en]),
			);
			const renameSport = screen.getByRole('button', {
				name: m.gift_category_rename_label({ category: 'Sport' }),
			});
			await expect.element(renameSport).toBeEnabled();

			await renameSport.click();
			await screen
				.getByRole('textbox', { name: m.gift_category_quick_add_name_label() })
				.fill('Sports');
			await userEvent.keyboard('{Enter}');
			submitSettings();

			await vi.waitFor(() =>
				expect(remoteMocks.save).toHaveBeenCalledWith({
					wishlistId: 'wishlist-1',
					categories: [
						{ id: 'books', label: books.labels.en, color: '#2563EB' },
						{ id: 'sport', label: 'Sports', color: '#0369A1' },
						{ id: 'toys', label: toys.labels.en, color: '#D97706' },
					],
					confirmedRemovalCategoryIds: [],
				}),
			);
			expect(keepsPresetLabel('books', books.labels.en)).toBe(true);
			expect(keepsPresetLabel('toys', toys.labels.en)).toBe(true);
		} finally {
			overwriteGetLocale(() => 'cs');
		}
	});
});

describe('WishlistCategorySettings reorder', () => {
	function pointer(type: string, target: EventTarget, x: number, y: number) {
		target.dispatchEvent(
			new PointerEvent(type, {
				bubbles: true,
				cancelable: true,
				pointerId: 7,
				isPrimary: true,
				button: 0,
				clientX: x,
				clientY: y,
			}),
		);
	}

	it('drags a category by its grip and cancels a drag on Escape', async () => {
		remoteMocks.categories = [
			category({ id: 'sport', customLabel: 'Sport' }),
			category({ id: 'bikes', customLabel: 'Kola', sortOrder: 1 }),
			category({ id: 'music', customLabel: 'Hudba', sortOrder: 2 }),
		];
		await page.viewport(1280, 800);
		const screen = renderSettings();
		const grip = screen.getByRole('button', {
			name: m.gift_category_move_label({ category: 'Sport' }),
		});
		await expect.element(grip).toBeEnabled();
		const rows = [...document.querySelectorAll<HTMLElement>('[data-category-row]')];
		const rowPitch =
			rows[1]!.getBoundingClientRect().top - rows[0]!.getBoundingClientRect().top;
		const gripRect = grip.element().getBoundingClientRect();
		const startX = gripRect.left + gripRect.width / 2;
		const startY = gripRect.top + gripRect.height / 2;

		pointer('pointerdown', grip.element(), startX, startY);
		pointer('pointermove', window, startX, startY + rowPitch);
		await vi.waitFor(() => expect(rowLabels()).toEqual(['Kola', 'Sport', 'Hudba']));
		pointer('pointerup', window, startX, startY + rowPitch);
		await expect.element(grip).toBeVisible();

		const movedGripRect = grip.element().getBoundingClientRect();
		const movedX = movedGripRect.left + movedGripRect.width / 2;
		const movedY = movedGripRect.top + movedGripRect.height / 2;
		pointer('pointerdown', grip.element(), movedX, movedY);
		pointer('pointermove', window, movedX, movedY + rowPitch);
		await vi.waitFor(() => expect(rowLabels()).toEqual(['Kola', 'Hudba', 'Sport']));
		await userEvent.keyboard('{Escape}');

		await vi.waitFor(() => expect(rowLabels()).toEqual(['Kola', 'Sport', 'Hudba']));
		submitSettings();
		await vi.waitFor(() => expect(remoteMocks.save).toHaveBeenCalledOnce());
		expect(
			remoteMocks.save.mock.calls[0]![0].categories.map(({ id }: { id: string }) => id),
		).toEqual(['bikes', 'sport', 'music']);
	});

	it('moves a category with the arrow keys on its grip and keeps focus on the grip', async () => {
		remoteMocks.categories = [
			category({ id: 'sport', customLabel: 'Sport' }),
			category({ id: 'books', presetKey: 'books', customLabel: null, sortOrder: 1 }),
			category({ id: 'bikes', customLabel: 'Kola', sortOrder: 2 }),
		];
		const screen = renderSettings();
		const grip = screen.getByRole('button', {
			name: m.gift_category_move_label({ category: 'Sport' }),
		});
		await expect.element(grip).toBeEnabled();

		grip.element().focus();
		await userEvent.keyboard('{ArrowDown}');
		await vi.waitFor(() => expect(rowLabels()).toEqual([books.labels.cs, 'Sport', 'Kola']));
		await expect.element(grip).toHaveFocus();
		await userEvent.keyboard('{ArrowDown}');
		await vi.waitFor(() => expect(rowLabels()).toEqual([books.labels.cs, 'Kola', 'Sport']));
		await expect.element(grip).toHaveFocus();
		await userEvent.keyboard('{ArrowDown}');
		expect(rowLabels()).toEqual([books.labels.cs, 'Kola', 'Sport']);

		submitSettings();
		await vi.waitFor(() => expect(remoteMocks.save).toHaveBeenCalledOnce());
		expect(
			remoteMocks.save.mock.calls[0]![0].categories.map(({ id }: { id: string }) => id),
		).toEqual(['books', 'bikes', 'sport']);
	});
});

describe('WishlistCategorySettings removal', () => {
	it('drops an unused category at once without a confirmation', async () => {
		remoteMocks.categories = [
			category({ id: 'sport', customLabel: 'Sport', usedCount: 0 }),
			category({ id: 'bikes', customLabel: 'Kola', sortOrder: 1 }),
		];
		const screen = renderSettings();

		await screen
			.getByRole('button', { name: m.gift_category_remove_label({ category: 'Sport' }) })
			.click();

		await vi.waitFor(() => expect(rowLabels()).toEqual(['Kola']));
		expect(document.querySelector('[role="dialog"]')).toBeNull();
		submitSettings();
		await vi.waitFor(() =>
			expect(remoteMocks.save).toHaveBeenCalledWith({
				wishlistId: 'wishlist-1',
				categories: [{ id: 'bikes', label: 'Kola', color: '#0369A1' }],
				confirmedRemovalCategoryIds: [],
			}),
		);
	});

	it('stages a used category in place and confirms its removal with the save', async () => {
		remoteMocks.categories = [
			category({ id: 'sport', customLabel: 'Sport', usedCount: 3 }),
			category({ id: 'bikes', customLabel: 'Kola', sortOrder: 1 }),
		];
		const screen = renderSettings();

		await screen
			.getByRole('button', { name: m.gift_category_remove_label({ category: 'Sport' }) })
			.click();

		await expect
			.element(page.getByTestId('gift-category-removal-note'))
			.toHaveTextContent(m.gift_category_removal_staged_other({ count: 3 }));
		expect(rowLabels()).toEqual(['Sport', 'Kola']);
		await expect
			.element(page.getByTestId('gift-category-count'))
			.toHaveTextContent(m.gift_categories_count_one());
		const stagedRow = document.querySelector('[data-category-id="sport"]')!;
		expect(stagedRow.querySelector('[data-category-grip]')).toBeNull();
		expect(stagedRow.querySelector('input[type="color"]')).toBeNull();
		const undo = screen.getByRole('button', { name: m.gift_category_removal_undo() });
		await expect.element(undo).toHaveFocus();

		submitSettings();
		await vi.waitFor(() =>
			expect(remoteMocks.save).toHaveBeenCalledWith({
				wishlistId: 'wishlist-1',
				categories: [{ id: 'bikes', label: 'Kola', color: '#0369A1' }],
				confirmedRemovalCategoryIds: ['sport'],
			}),
		);
		await vi.waitFor(() => expect(rowLabels()).toEqual(['Kola']));
	});

	it('restores a staged category with Vrátit', async () => {
		remoteMocks.categories = [category({ id: 'sport', customLabel: 'Sport', usedCount: 2 })];
		const screen = renderSettings();
		const remove = screen.getByRole('button', {
			name: m.gift_category_remove_label({ category: 'Sport' }),
		});

		await remove.click();
		await screen.getByRole('button', { name: m.gift_category_removal_undo() }).click();

		await expect.element(remove).toHaveFocus();
		expect(page.getByTestId('gift-category-removal-note').elements()).toHaveLength(0);
		submitSettings();
		await vi.waitFor(() =>
			expect(remoteMocks.save).toHaveBeenCalledWith({
				wishlistId: 'wishlist-1',
				categories: [{ id: 'sport', label: 'Sport', color: '#0369A1' }],
				confirmedRemovalCategoryIds: [],
			}),
		);
	});

	it('refreshes and requires a fresh staging after a concurrent category conflict', async () => {
		remoteMocks.categories = [category({ id: 'sport', customLabel: 'Sport', usedCount: 1 })];
		remoteMocks.save.mockRejectedValue(
			new Error(SERVER_ERROR.GIFT_CATEGORY_REMOVAL_CONFIRMATION_MISMATCH),
		);
		const screen = renderSettings();
		await vi.waitFor(() => expect(remoteMocks.refresh).toHaveBeenCalledOnce());
		remoteMocks.refresh.mockClear();
		const remove = screen.getByRole('button', {
			name: m.gift_category_remove_label({ category: 'Sport' }),
		});

		await remove.click();
		submitSettings();

		await vi.waitFor(() => expect(remoteMocks.refresh).toHaveBeenCalledOnce());
		await expect.element(remove).toBeEnabled();
		expect(page.getByTestId('gift-category-removal-note').elements()).toHaveLength(0);
	});
});

describe('WishlistCategorySettings new category', () => {
	it('appends new categories at the end and keeps the input ready for the next one', async () => {
		remoteMocks.categories = [category({ id: 'sport', customLabel: 'Sport' })];
		const screen = renderSettings();
		const newCategory = screen.getByRole('button', { name: m.gift_category_new() });
		await expect.element(newCategory).toBeEnabled();

		await newCategory.click();
		const input = screen.getByRole('textbox', { name: m.gift_category_quick_add_name_label() });
		await expect.element(input).toHaveFocus();
		await userEvent.keyboard('Knihy pro děti');
		await expect
			.element(page.getByTestId('gift-category-new-preview'))
			.toHaveTextContent('Knihy pro děti');
		await userEvent.keyboard('{Enter}');
		await expect.element(input).toHaveValue('');
		await expect.element(input).toHaveFocus();
		await userEvent.keyboard('Hudba');
		await screen.getByRole('button', { name: m.gift_category_add() }).click();

		await vi.waitFor(() => expect(rowLabels()).toEqual(['Sport', 'Knihy pro děti', 'Hudba']));
		expect(remoteMocks.save).not.toHaveBeenCalled();
		submitSettings();
		await vi.waitFor(() => expect(remoteMocks.save).toHaveBeenCalledOnce());
		expect(remoteMocks.save.mock.calls[0]![0].categories).toMatchObject([
			{ id: 'sport', label: 'Sport' },
			{ id: null, label: 'Knihy pro děti' },
			{ id: null, label: 'Hudba' },
		]);
	});

	it('rejects a duplicate name inline and closes on Escape', async () => {
		remoteMocks.categories = [category({ id: 'books', presetKey: 'books', customLabel: null })];
		const screen = renderSettings();
		const newCategory = screen.getByRole('button', { name: m.gift_category_new() });
		await expect.element(newCategory).toBeEnabled();

		await newCategory.click();
		await userEvent.keyboard(`${books.labels.cs}{Enter}`);

		await expect
			.element(screen.getByText(m.server_error_gift_category_label_conflict()))
			.toBeVisible();
		expect(rowLabels()).toEqual([books.labels.cs]);
		await userEvent.keyboard('{Escape}');
		await expect.element(page.getByTestId('gift-category-new-row')).not.toBeInTheDocument();
		await expect.element(newCategory).toHaveFocus();
	});
});
