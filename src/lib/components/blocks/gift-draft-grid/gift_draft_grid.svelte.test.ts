import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from 'vitest-browser-svelte';
import GiftDraftGrid from './GiftDraftGrid.svelte';
import type { GiftDraft } from '$lib/modules/gifts/gift_draft.js';
import { DEFAULT_GIFT_CURRENCY } from '$lib/modules/gifts/types.js';

function makeDraft(overrides: Partial<GiftDraft> = {}): GiftDraft {
	return {
		name: '',
		description: null,
		links: [],
		price: null,
		currency: DEFAULT_GIFT_CURRENCY,
		...overrides,
	};
}

afterEach(() => {
	cleanup();
});

describe('GiftDraftGrid', () => {
	// 1. Edit name — type into name input, row status transitions from error to ready
	it('typing a name transitions the row from error to ready status', async () => {
		const screen = render(GiftDraftGrid, {
			initialDrafts: [makeDraft()],
			mode: 'import',
		});

		const row = screen.getByTestId('draft-row');
		await expect.element(row).toHaveAttribute('data-status', 'error');

		const nameInput = screen.getByPlaceholder('Zadejte název');
		await nameInput.fill('Kniha');

		await expect.element(row).toHaveAttribute('data-status', 'ready');
		expect(true).toBe(true);
	});

	// 2. Clear name — clear a filled name, row transitions to error
	it('clearing the name transitions the row back to error with help text', async () => {
		const screen = render(GiftDraftGrid, {
			initialDrafts: [makeDraft({ name: 'Kniha' })],
			mode: 'import',
		});

		const row = screen.getByTestId('draft-row');
		await expect.element(row).toHaveAttribute('data-status', 'ready');

		const nameInput = screen.getByPlaceholder('Zadejte název');
		await nameInput.fill('');

		await expect.element(row).toHaveAttribute('data-status', 'error');
		await expect.element(screen.getByText('Zadejte název')).toBeInTheDocument();
		expect(true).toBe(true);
	});

	// 3. Add link — click "+ odkaz", new link input appears; enter URL, clickable anchor appears
	it('adding a link shows a clickable anchor with the domain', async () => {
		const screen = render(GiftDraftGrid, {
			initialDrafts: [makeDraft({ name: 'Kniha' })],
			mode: 'import',
		});

		const addLinkButton = screen.getByRole('button', { name: /odkaz/i });
		await addLinkButton.click();

		const linkInput = screen.getByPlaceholder('https://...');
		await expect.element(linkInput).toBeVisible();

		await linkInput.fill('https://alza.cz/kniha');
		await linkInput
			.element()
			.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

		// After committing, an anchor should appear with the domain
		const anchor = screen.getByRole('link', { name: /alza\.cz/i });
		await expect.element(anchor).toBeVisible();
		await expect.element(anchor).toHaveAttribute('href', 'https://alza.cz/kniha');
		await expect.element(anchor).toHaveAttribute('target', '_blank');
		expect(true).toBe(true);
	});

	// 4. Remove link — click X on existing link, link removed from row
	it('removing a link removes the anchor from the row', async () => {
		const screen = render(GiftDraftGrid, {
			initialDrafts: [
				makeDraft({ name: 'Kniha', links: [{ url: 'https://alza.cz/kniha' }] }),
			],
			mode: 'import',
		});

		// Link should be visible
		const anchor = screen.getByRole('link', { name: /alza\.cz/i });
		await expect.element(anchor).toBeVisible();

		// Click the remove button for the link
		const removeButton = screen.getByRole('button', { name: /Odebrat odkaz/i });
		await removeButton.click();

		// The anchor should no longer be in the document
		await expect
			.element(screen.getByRole('link', { name: /alza\.cz/i }))
			.not.toBeInTheDocument();
		expect(true).toBe(true);
	});

	// 5. Select/deselect row — toggle checkbox, row gains/loses excluded (dimmed) state
	it('deselecting a row marks it as excluded (dimmed)', async () => {
		const screen = render(GiftDraftGrid, {
			initialDrafts: [makeDraft({ name: 'Kniha' })],
			mode: 'import',
		});

		const row = screen.getByTestId('draft-row');
		await expect.element(row).toHaveAttribute('data-excluded', 'false');

		// The row checkbox
		const checkbox = screen.getByRole('checkbox', { name: /Vybrat řádek/i });
		await checkbox.click();

		await expect.element(row).toHaveAttribute('data-excluded', 'true');

		// Click again to re-select
		await checkbox.click();
		await expect.element(row).toHaveAttribute('data-excluded', 'false');
		expect(true).toBe(true);
	});

	// 6. Select-all tri-state — partial selection -> indeterminate; click toggles all on; click toggles all off
	it('select-all checkbox shows indeterminate for partial selection and toggles all', async () => {
		const screen = render(GiftDraftGrid, {
			initialDrafts: [makeDraft({ name: 'A' }), makeDraft({ name: 'B' })],
			mode: 'import',
		});

		// Initially all selected — the select-all checkbox should be checked
		const selectAll = screen.getByRole('checkbox', { name: /Vybrat vše/i });
		await expect.element(selectAll).toHaveAttribute('aria-checked', 'true');

		// Deselect one row to create partial selection
		const rowCheckboxes = screen.getByRole('checkbox', { name: /Vybrat řádek/i });
		await rowCheckboxes.nth(0).click();

		// Select-all should now be indeterminate (bits-ui uses data-state="indeterminate")
		await expect.element(selectAll).toHaveAttribute('data-state', 'indeterminate');

		// Click select-all to select all
		await selectAll.click();
		const rows = screen.getByTestId('draft-row');
		await expect.element(rows.nth(0)).toHaveAttribute('data-excluded', 'false');
		await expect.element(rows.nth(1)).toHaveAttribute('data-excluded', 'false');

		// Click again to deselect all
		await selectAll.click();
		await expect.element(rows.nth(0)).toHaveAttribute('data-excluded', 'true');
		await expect.element(rows.nth(1)).toHaveAttribute('data-excluded', 'true');
		expect(true).toBe(true);
	});

	// 7. Bulk delete — select rows, click "Smazat vybrané", rows removed
	it('bulk delete removes selected rows', async () => {
		const screen = render(GiftDraftGrid, {
			initialDrafts: [
				makeDraft({ name: 'A' }),
				makeDraft({ name: 'B' }),
				makeDraft({ name: 'C' }),
			],
			mode: 'import',
		});

		// Initially 3 rows, all selected
		let rows = screen.getByTestId('draft-row');
		expect(await rows.all()).toHaveLength(3);

		// Deselect row "C" so only A and B are selected
		const rowCheckboxes = screen.getByRole('checkbox', { name: /Vybrat řádek/i });
		await rowCheckboxes.nth(2).click();

		// Click delete selected
		const deleteButton = screen.getByRole('button', { name: /Smazat vybrané/i });
		await deleteButton.click();

		// Should only have row C left
		rows = screen.getByTestId('draft-row');
		expect(await rows.all()).toHaveLength(1);
		expect(true).toBe(true);
	});

	// 8. Invalid row — blank name selected row shows red tint + "Zadejte název" help text
	it('a blank-name selected row shows error status and help text', async () => {
		const screen = render(GiftDraftGrid, {
			initialDrafts: [makeDraft()],
			mode: 'import',
		});

		const row = screen.getByTestId('draft-row');
		await expect.element(row).toHaveAttribute('data-status', 'error');

		// Help text should be visible
		await expect.element(screen.getByText('Zadejte název')).toBeInTheDocument();
		expect(true).toBe(true);
	});

	// 9. Currency select — default CZK, can change to EUR/USD, value persists
	it('currency defaults to CZK and can be changed to EUR', async () => {
		const screen = render(GiftDraftGrid, {
			initialDrafts: [makeDraft({ name: 'Kniha' })],
			mode: 'import',
		});

		const currencySelect = screen.getByRole('combobox', { name: /Měna/i });
		// If no combobox, try a select element
		const fallback = currencySelect.elements().length === 0;

		if (!fallback) {
			await expect.element(currencySelect).toHaveValue('CZK');
			// Change to EUR
			await currencySelect.selectOptions('EUR');
			await expect.element(currencySelect).toHaveValue('EUR');
		} else {
			// Native select — query by aria-label
			const select = screen.getByLabelText('Měna');
			await expect.element(select).toHaveValue('CZK');
			await select.selectOptions('EUR');
			await expect.element(select).toHaveValue('EUR');
		}
		expect(true).toBe(true);
	});

	// 10. Duplicate badge — import mode row matching existing gift shows orange tint + "možný duplikát" badge
	it('a row matching an existing gift shows duplicate status and badge', async () => {
		const screen = render(GiftDraftGrid, {
			initialDrafts: [makeDraft({ name: 'Kniha' })],
			existingGifts: [{ name: 'Kniha' }],
			mode: 'import',
		});

		const row = screen.getByTestId('draft-row');
		await expect.element(row).toHaveAttribute('data-status', 'duplicate');
		// Scope to the row to avoid matching the legend text ("Možný duplikát")
		await expect.element(row.getByText('možný duplikát')).toBeInTheDocument();
		expect(true).toBe(true);
	});

	// 11. Pristine batch row — untouched row in batch mode shows neutral (no error tint), not red
	it('an untouched batch-mode row shows neutral status, not error', async () => {
		const screen = render(GiftDraftGrid, {
			initialDrafts: [],
			mode: 'batch',
		});

		// Add a row via the "Přidat řádek" button
		const addButton = screen.getByRole('button', { name: /Přidat řádek/i });
		await addButton.click();

		const row = screen.getByTestId('draft-row');
		await expect.element(row).toHaveAttribute('data-status', 'neutral');

		// Should NOT show error help text
		const helpText = screen.getByText('Zadejte název');
		await expect.element(helpText).not.toBeInTheDocument();
		expect(true).toBe(true);
	});
});
