import { cleanup, render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'svelte';
import * as m from '$lib/paraglide/messages.js';
import { REVERT_CAPABILITY } from '$lib/modules/wishlists/wishlist_capabilities.js';
import { WISHLIST_ROLES, type Wishlist } from '$lib/modules/wishlists/types.js';
import { GIFT_CATEGORY_PRESETS } from '$lib/modules/gift-categories/types.js';
import { createDefaultWishlistSlots } from '$lib/modules/images/index.js';

const remoteMocks = vi.hoisted(() => ({
	saveGiftCategorySettingsCommand: vi.fn(),
}));
vi.mock('$env/dynamic/public', () => ({ env: {} }));
vi.mock('$lib/modules/gift-categories/gift_categories.remote.js', () => ({
	getGiftCategories: vi.fn(() => ({ current: [] })),
	getGiftCategorySettingsRows: vi.fn(() => ({ current: [] })),
	saveGiftCategorySettingsCommand: remoteMocks.saveGiftCategorySettingsCommand,
}));

import WishlistSettingsModal from './WishlistSettingsModal.svelte';

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

const wishlist: Wishlist = {
	id: 'wishlist-settings-test',
	shortId: 'settings1',
	recipientUserId: 'recipient-1',
	recipientName: null,
	title: 'Test wishlist',
	description: null,
	eventDate: null,
	status: 'draft',
	theme: 'default',
	customThemeColor: null,
	palette: 'sky',
	imageKey: null,
	imageSlots: null,
	recipientIsModerator: false,
	sharedAt: null,
	eventDateEditedAt: null,
	archivedAt: null,
	deletedAt: null,
	createdAt: new Date('2026-01-01T00:00:00Z'),
	updatedAt: new Date('2026-01-01T00:00:00Z'),
};

function renderSettings(overrides: Partial<ComponentProps<typeof WishlistSettingsModal>> = {}) {
	return render(WishlistSettingsModal, {
		open: true,
		activeTab: 'details',
		wishlist,
		canManage: true,
		role: WISHLIST_ROLES.recipient,
		revertCapability: REVERT_CAPABILITY.hidden,
		recipientDisplayName: 'Test Recipient',
		themeEmoji: '🎁',
		onsaved: async () => {},
		onimport: () => {},
		onexport: () => {},
		...overrides,
	});
}

describe('WishlistSettingsModal import and export tab', () => {
	it('keeps spreadsheet actions out of Details and reveals them only on the dedicated tab', async () => {
		const screen = renderSettings();

		await expect
			.element(screen.getByRole('button', { name: m.import_toolbar_label() }))
			.not.toBeInTheDocument();
		await expect
			.element(screen.getByRole('button', { name: m.export_toolbar_label() }))
			.not.toBeInTheDocument();

		await screen.getByRole('tab', { name: m.wishlist_settings_data_title() }).click();

		await expect
			.element(screen.getByRole('button', { name: m.import_toolbar_label() }))
			.toBeVisible();
		await expect
			.element(screen.getByRole('button', { name: m.export_toolbar_label() }))
			.toBeVisible();
	});

	it('keeps the existing import and export callbacks on the dedicated tab actions', async () => {
		const onimport = vi.fn();
		const onexport = vi.fn();
		const screen = renderSettings({ onimport, onexport });

		await screen.getByRole('tab', { name: m.wishlist_settings_data_title() }).click();
		await screen.getByRole('button', { name: m.import_toolbar_label() }).click();
		await screen.getByRole('button', { name: m.export_toolbar_label() }).click();

		expect(onimport).toHaveBeenCalledOnce();
		expect(onexport).toHaveBeenCalledOnce();
	});

	it('guards Import with the category discard confirmation', async () => {
		const onimport = vi.fn();
		const confirm = vi
			.spyOn(window, 'confirm')
			.mockReturnValueOnce(false)
			.mockReturnValueOnce(true);
		const screen = renderSettings({ onimport, activeTab: 'categories' });

		const customInput = screen.getByPlaceholder(m.gift_category_custom_placeholder());
		await customInput.fill('Nová kategorie');
		await screen.getByRole('button', { name: m.gift_category_create() }).click();
		await screen.getByRole('tab', { name: m.wishlist_settings_data_title() }).click();

		await screen.getByRole('button', { name: m.import_toolbar_label() }).click();
		expect(onimport).not.toHaveBeenCalled();
		await expect
			.element(screen.getByRole('dialog', { name: m.wishlist_settings_title() }))
			.toBeVisible();

		await screen.getByRole('button', { name: m.import_toolbar_label() }).click();
		expect(onimport).toHaveBeenCalledOnce();
		expect(confirm).toHaveBeenCalledTimes(2);
	});

	it('enables the Details Save only for a meaningful change', async () => {
		const screen = renderSettings();
		const save = screen.getByRole('button', { name: m.save() });
		const title = screen.getByLabelText(m.wishlist_name_label());

		await expect.element(save).toBeDisabled();
		await title.fill('Updated wishlist');
		await expect.element(save).toBeEnabled();
		await title.fill(wishlist.title);
		await expect.element(save).toBeDisabled();
	});

	it('enables the Image Save only after the image settings change', async () => {
		const screen = renderSettings({
			activeTab: 'image',
			wishlist: {
				...wishlist,
				imageKey: 'demo/backpack.jpg',
				imageSlots: createDefaultWishlistSlots(),
			},
		});
		const save = screen.getByRole('button', { name: m.save() });

		await expect.element(save).toBeDisabled();
		await screen.getByRole('radio', { name: m.image_fit_fit() }).click();
		await expect.element(save).toBeEnabled();
		await screen.getByRole('radio', { name: m.image_fit_fill() }).click();
		await expect.element(save).toBeDisabled();
		await screen.getByRole('button', { name: m.wishlist_image_remove() }).click();
		await expect.element(save).toBeEnabled();
	});

	it('commits all staged category changes only from the dialog footer Save', async () => {
		remoteMocks.saveGiftCategorySettingsCommand.mockReset();
		let resolveSave!: () => void;
		remoteMocks.saveGiftCategorySettingsCommand.mockImplementationOnce(
			() => new Promise<void>((resolve) => (resolveSave = resolve)),
		);
		const screen = renderSettings({ activeTab: 'categories' });

		await screen.getByPlaceholder(m.gift_category_custom_placeholder()).fill('Nová kategorie');
		await screen.getByRole('button', { name: m.gift_category_create() }).click();
		const preset = GIFT_CATEGORY_PRESETS[0]!;
		const presetLabel = preset.labels.cs;
		await screen.getByText(presetLabel).click();

		expect(remoteMocks.saveGiftCategorySettingsCommand).not.toHaveBeenCalled();
		const save = screen.getByRole('button', { name: m.save() });
		await expect.element(save).toBeEnabled();
		const saveElement = save.element() as HTMLButtonElement;
		await save.click();

		expect(remoteMocks.saveGiftCategorySettingsCommand).toHaveBeenCalledOnce();
		expect(remoteMocks.saveGiftCategorySettingsCommand).toHaveBeenCalledWith({
			wishlistId: wishlist.id,
			customCategories: [{ id: null, label: 'Nová kategorie', color: '#0369A1' }],
			presetKeys: [preset.key],
			presetColors: [{ key: preset.key, color: preset.color }],
			confirmedRemovalCategoryIds: [],
		});
		await vi.waitFor(() => expect(saveElement.disabled).toBe(true));
		resolveSave();
		await vi.waitFor(() => {
			expect(saveElement.textContent).toContain(m.save());
			expect(saveElement.disabled).toBe(true);
		});
	});

	it('closes without a discard prompt after a category save completes', async () => {
		remoteMocks.saveGiftCategorySettingsCommand.mockReset();
		let resolveSave!: () => void;
		remoteMocks.saveGiftCategorySettingsCommand.mockImplementationOnce(
			() => new Promise<void>((resolve) => (resolveSave = resolve)),
		);
		const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
		const screen = renderSettings({ activeTab: 'categories' });

		await screen.getByPlaceholder(m.gift_category_custom_placeholder()).fill('Nová kategorie');
		await screen.getByRole('button', { name: m.gift_category_create() }).click();
		const save = screen.getByRole('button', { name: m.save() });
		await save.click();
		await vi.waitFor(() =>
			expect(remoteMocks.saveGiftCategorySettingsCommand).toHaveBeenCalledOnce(),
		);
		resolveSave();
		await expect.element(save).toBeDisabled();
		await expect.element(save).toHaveAttribute('aria-busy', 'false');
		expect(confirm).not.toHaveBeenCalled();
		await screen.getByRole('button', { name: m.close() }).click();

		expect(confirm).not.toHaveBeenCalled();
		await expect
			.element(screen.getByRole('dialog', { name: m.wishlist_settings_title() }))
			.not.toBeInTheDocument();
	});

	it.each([
		['categories' as const, 'wishlist-categories-form'],
		['image' as const, 'wishlist-image-form'],
	])('keeps the %s Save visible outside the scrolling form', async (activeTab, formId) => {
		const screen = renderSettings({ activeTab });
		const dialog = screen.getByRole('dialog', { name: m.wishlist_settings_title() }).element();
		const form = document.getElementById(formId)!;
		const save = dialog.querySelector<HTMLButtonElement>(`button[form="${formId}"]`)!;
		const footer = save.closest<HTMLElement>('[data-slot="dialog-footer"]')!;
		const scrollBody = footer.previousElementSibling as HTMLElement;

		expect(dialog.contains(save)).toBe(true);
		expect(form.contains(save)).toBe(false);
		expect(scrollBody.contains(save)).toBe(false);
		dialog.style.cssText +=
			'; display: flex; flex-direction: column; height: 240px; max-height: 240px';
		scrollBody.style.cssText += '; min-height: 0; flex: 1; overflow-y: auto';
		footer.style.cssText += '; flex: none';
		scrollBody.scrollTop = scrollBody.scrollHeight;
		await new Promise((resolve) => requestAnimationFrame(resolve));
		const saveRect = save.getBoundingClientRect();
		const dialogRect = dialog.getBoundingClientRect();
		expect(saveRect.top).toBeGreaterThanOrEqual(dialogRect.top);
		expect(saveRect.bottom).toBeLessThanOrEqual(dialogRect.bottom);
		expect(saveRect.top).toBeGreaterThanOrEqual(0);
		expect(saveRect.bottom).toBeLessThanOrEqual(window.innerHeight);
	});

	it('keeps a viewport-bounded shell and footer height stable across tabs without actions', async () => {
		const screen = renderSettings();
		const dialog = screen.getByRole('dialog', { name: m.wishlist_settings_title() }).element();
		const footer = screen.getByTestId('wishlist-settings-footer').element();
		const initialDialogHeight = dialog.getBoundingClientRect().height;
		const initialFooterHeight = footer.getBoundingClientRect().height;

		expect(dialog.style.height).toBe('min(52rem, 85dvh)');
		expect(dialog.style.maxHeight).toContain('100dvh');
		expect(dialog.style.maxHeight).toContain('2rem');
		expect(screen.getByTestId('wishlist-settings-scroll-region').element().classList).toContain(
			'overflow-y-auto',
		);
		await expect.element(screen.getByRole('button', { name: m.save() })).toBeVisible();

		await screen.getByRole('tab', { name: m.wishlist_settings_data_title() }).click();

		expect(screen.getByTestId('wishlist-settings-footer').element()).toBe(footer);
		expect(dialog.getBoundingClientRect().height).toBe(initialDialogHeight);
		expect(footer.getBoundingClientRect().height).toBe(initialFooterHeight);
		await expect
			.element(screen.getByRole('button', { name: m.save() }))
			.not.toBeInTheDocument();
	});

	it('widens this dialog and gives the desktop navigation six equal full-width columns', () => {
		const screen = renderSettings();
		const dialog = screen.getByRole('dialog', { name: m.wishlist_settings_title() }).element();
		const tablist = screen
			.getByRole('tablist', { name: m.wishlist_settings_title() })
			.element();

		expect(dialog.classList).toContain('sm:max-w-[calc(100%-2rem)]');
		expect(dialog.classList).toContain('xl:max-w-5xl');
		expect(tablist.classList).toContain('lg:w-full');
		expect(tablist.classList).toContain('lg:grid-cols-6');
	});

	it('uses a vertical sidebar at intermediate widths and conceals the mobile native scrollbar', () => {
		const screen = renderSettings();
		const tablist = screen
			.getByRole('tablist', { name: m.wishlist_settings_title() })
			.element();
		const layout = tablist.parentElement!;

		expect(layout.classList).toContain('sm:grid-cols-[12rem_minmax(0,1fr)]');
		expect(layout.classList).toContain('lg:grid-cols-1');
		expect(tablist.classList).toContain('sm:flex-col');
		expect(tablist.classList).toContain('[scrollbar-width:none]');
		expect(tablist.classList).toContain('[&::-webkit-scrollbar]:hidden');
	});

	it('reports the responsive visual orientation to assistive technology', async () => {
		const screen = renderSettings();
		const expectedOrientation = window.matchMedia('(min-width: 640px) and (max-width: 1023px)')
			.matches
			? 'vertical'
			: 'horizontal';

		await expect
			.element(screen.getByRole('tablist', { name: m.wishlist_settings_title() }))
			.toHaveAttribute('aria-orientation', expectedOrientation);
	});

	it('separates the Danger panel from navigation and lets it fill the content column', async () => {
		const screen = renderSettings();
		const tablist = screen
			.getByRole('tablist', { name: m.wishlist_settings_title() })
			.element();
		await screen.getByRole('tab', { name: m.wishlist_settings_danger_tab() }).click();
		const dangerPanel = screen
			.getByRole('tabpanel', { name: m.wishlist_settings_danger_tab() })
			.element();

		expect(tablist.parentElement?.classList).toContain('gap-4');
		expect(dangerPanel.parentElement?.classList).toContain('w-full');
		expect(dangerPanel.classList).toContain('w-full');
	});

	it('keeps keyboard-selected tabs visible in the mobile-width overflow', async () => {
		const screen = renderSettings();
		const dialog = screen.getByRole('dialog', { name: m.wishlist_settings_title() }).element();
		const tablist = screen
			.getByRole('tablist', { name: m.wishlist_settings_title() })
			.element();
		dialog.style.cssText = 'height: 240px; overflow-y: auto; overflow-anchor: none';
		tablist.style.cssText = 'display: flex; overflow-x: auto; width: 220px';
		const details = screen.getByRole('tab', { name: m.wishlist_settings_details_section() });
		const danger = screen.getByRole('tab', { name: m.wishlist_settings_danger_tab() });
		details.element().focus();
		for (const tab of screen.getByRole('tab').all()) {
			tab.element().style.cssText = 'flex: none; width: 110px';
		}

		expect(tablist.scrollWidth).toBeGreaterThan(tablist.clientWidth);
		dialog.scrollTop = 80;
		expect(dialog.scrollTop).toBeGreaterThan(0);
		const dialogScrollTop = dialog.scrollTop;
		const pageScrollY = window.scrollY;
		await userEvent.keyboard('{End}');

		await expect.element(danger).toHaveFocus();
		await expect.element(danger).toHaveAttribute('aria-selected', 'true');
		let tablistRect = tablist.getBoundingClientRect();
		const dangerRect = danger.element().getBoundingClientRect();
		expect(dangerRect.left).toBeGreaterThanOrEqual(tablistRect.left);
		expect(dangerRect.right).toBeLessThanOrEqual(tablistRect.right);
		expect(dialog.scrollTop).toBe(dialogScrollTop);
		expect(window.scrollY).toBe(pageScrollY);

		await userEvent.keyboard('{Home}');
		await expect.element(details).toHaveFocus();
		tablistRect = tablist.getBoundingClientRect();
		const detailsRect = details.element().getBoundingClientRect();
		expect(detailsRect.left).toBeGreaterThanOrEqual(tablistRect.left);
		expect(detailsRect.right).toBeLessThanOrEqual(tablistRect.right);
		expect(dialog.scrollTop).toBe(dialogScrollTop);
		expect(window.scrollY).toBe(pageScrollY);
	});
});
