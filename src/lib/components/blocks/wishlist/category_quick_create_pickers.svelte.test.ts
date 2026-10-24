import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import GiftContextActions from './GiftContextActions.svelte';
import GiftContextActionsTestHost from './GiftContextActionsTestHost.svelte';
import WishlistSelectionToolbar from './WishlistSelectionToolbar.svelte';
import { selectionCategoryChoices } from './selection_category_choices.test_fixtures.js';

// Issue #519: every category picker ends with “Vytvořit kategorii”, separated from the
// categories, and only viewers who may manage categories get it.

function contextProps() {
	return {
		sessionId: 1,
		nativeOpen: false,
		programmaticOpen: true,
		mobile: true,
		name: 'Kolo',
		role: 'recipient' as const,
		primaryUrl: null,
		readOnly: false,
		received: false,
		priorityLevels: [{ id: 'high', label: 'Vysoká' }],
		categories: [
			{ id: 'sport', label: 'Sport' },
			{ id: 'books', label: 'Knihy' },
		],
		priorityReady: true,
		categoryReady: true,
		priorityLevelId: null,
		categoryIds: [] as readonly string[],
		onclose: vi.fn(),
		oncomplete: vi.fn(),
		onfinish: vi.fn((_policy, callback: () => void) => callback()),
		onedit: vi.fn(),
		onpriority: vi.fn(),
		oncategory: vi.fn(),
		onreceived: vi.fn(),
		onselect: vi.fn(),
	};
}

function toolbarProps() {
	return {
		selectedCount: 2,
		hiddenCount: 0,
		visibleState: 'all' as const,
		priorityReady: true,
		categoryReady: true,
		priorityLevels: [{ id: 'high', label: 'Vysoká' }],
		categories: [
			{ id: 'sport', label: 'Sport' },
			{ id: 'books', label: 'Knihy' },
		],
		commonPriorityId: null,
		categoryChoices: selectionCategoryChoices({}, true),
		commonImageBackground: null,
		onselectvisible: vi.fn(),
		onpriority: vi.fn(),
		oncategory: vi.fn(),
		onaction: vi.fn(),
		ondone: vi.fn(),
	};
}

/** The element follows the last category option and a separator sits between them. */
function expectLastAfterSeparator(createOption: HTMLElement, lastCategoryLabel: string) {
	const container = createOption.closest(
		'[role="menu"], [data-mobile-screen], .bulk-sheet-options',
	);
	expect(container).not.toBeNull();
	const text = container!.textContent ?? '';
	expect(text.trimEnd().endsWith(m.gift_category_create())).toBe(true);
	expect(text.indexOf(lastCategoryLabel)).toBeLessThan(text.indexOf(m.gift_category_create()));
	const separators = container!.querySelectorAll('[data-slot$="separator"], [role="separator"]');
	expect(
		[...separators].some(
			(separator) =>
				separator.compareDocumentPosition(createOption) & Node.DOCUMENT_POSITION_FOLLOWING,
		),
	).toBe(true);
}

afterEach(async () => {
	await page.viewport(1280, 760);
});

describe('gift context menu category picker', () => {
	it('ends the desktop Category submenu with Create category, which starts creation', async () => {
		const anchor = document.createElement('button');
		document.body.append(anchor);
		const props = { ...contextProps(), oncreatecategory: vi.fn() };
		const screen = await render(GiftContextActionsTestHost, {
			...props,
			mobile: false,
			nativeOpen: false,
			programmaticOpen: true,
			desktopAnchor: anchor,
		});
		await screen.getByRole('menuitem', { name: m.gift_context_category() }).click();
		const createOption = screen.getByRole('menuitem', { name: m.gift_category_create() });
		await expect.element(createOption).toBeInTheDocument();
		expectLastAfterSeparator(createOption.element() as HTMLElement, 'Knihy');

		await createOption.click();
		await expect.poll(() => props.oncreatecategory).toHaveBeenCalledOnce();
		expect(props.oncategory).not.toHaveBeenCalled();
		await screen.unmount();
		anchor.remove();
	});

	it('ends the mobile Category screen with Create category', async () => {
		await page.viewport(390, 720);
		const props = { ...contextProps(), oncreatecategory: vi.fn() };
		const screen = await render(GiftContextActions, props);
		await screen.getByRole('button', { name: m.gift_context_category(), exact: true }).click();
		const createOption = screen.getByRole('button', { name: m.gift_category_create() });
		await expect.element(createOption).toBeInTheDocument();
		expectLastAfterSeparator(createOption.element() as HTMLElement, 'Knihy');

		await createOption.click();
		expect(props.oncreatecategory).toHaveBeenCalledOnce();
		expect(props.oncategory).not.toHaveBeenCalled();
		await screen.unmount();
	});

	it('offers no Create category without category-management rights', async () => {
		await page.viewport(390, 720);
		const screen = await render(GiftContextActions, contextProps());
		await screen.getByRole('button', { name: m.gift_context_category(), exact: true }).click();
		await expect.element(screen.getByRole('checkbox', { name: 'Knihy' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: m.gift_category_create() }).query()).toBeNull();
		await screen.unmount();
	});
});

describe('bulk selection category picker', () => {
	it('ends the desktop Actions → Category submenu with Create category', async () => {
		const props = { ...toolbarProps(), oncreatecategory: vi.fn() };
		const screen = await render(WishlistSelectionToolbar, props);
		await screen.getByTestId('desktop-selection-actions-trigger').click();
		await screen
			.getByRole('menuitem', { name: new RegExp(`^${m.gift_context_category()}:`) })
			.click();
		const createOption = screen.getByRole('menuitem', { name: m.gift_category_create() });
		await expect.element(createOption).toBeInTheDocument();
		expectLastAfterSeparator(createOption.element() as HTMLElement, 'Knihy');

		await createOption.click();
		expect(props.oncreatecategory).toHaveBeenCalledOnce();
		expect(props.oncategory).not.toHaveBeenCalled();
		await screen.unmount();
	});

	it('ends the mobile Category sheet with Create category and closes the sheet for it', async () => {
		await page.viewport(390, 760);
		const props = { ...toolbarProps(), oncreatecategory: vi.fn() };
		const screen = await render(WishlistSelectionToolbar, props);
		await screen.getByRole('button', { name: m.gift_selection_actions() }).click();
		await screen
			.getByTestId('selection-bulk-sheet-actions')
			.getByRole('button', { name: new RegExp(m.gift_context_category()) })
			.click();
		const createOption = screen.getByRole('button', { name: m.gift_category_create() });
		await expect.element(createOption).toBeInTheDocument();
		expect(screen.getByTestId('selection-bulk-sheet-options').element().textContent).toContain(
			'Knihy',
		);

		await createOption.click();
		await expect.poll(() => props.oncreatecategory).toHaveBeenCalledOnce();
		await expect
			.poll(() => screen.getByTestId('selection-bulk-sheet-options').query())
			.toBeNull();
		await screen.unmount();
	});

	it('offers no Create category without category-management rights', async () => {
		const screen = await render(WishlistSelectionToolbar, toolbarProps());
		await screen.getByTestId('desktop-selection-actions-trigger').click();
		await screen
			.getByRole('menuitem', { name: new RegExp(`^${m.gift_context_category()}:`) })
			.click();
		await expect
			.element(screen.getByRole('menuitemcheckbox', { name: 'Knihy' }))
			.toBeInTheDocument();
		expect(screen.getByRole('menuitem', { name: m.gift_category_create() }).query()).toBeNull();
		await screen.unmount();
	});
});
