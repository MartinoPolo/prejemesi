<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, userEvent, within } from 'storybook/test';
	import type { GiftDraft } from '$lib/modules/gifts/gift_draft.js';
	import { DRAFT_GRID_CONTEXT, type ExistingGiftRef } from './gift_draft_grid_model.js';
	import GiftDraftGrid from './GiftDraftGrid.svelte';

	const { Story } = defineMeta({
		title: 'Blocks/GiftDraftGrid/Grid',
		component: GiftDraftGrid,
		tags: ['autodocs'],
	});

	// ── Fixtures ────────────────────────────────────────────────────────────
	const SINGLE_NAMED: GiftDraft[] = [
		{ name: 'Ponožky', description: null, links: [], price: null, currency: 'CZK' },
	];

	const TWO_NAMED: GiftDraft[] = [
		{ name: 'Ponožky', description: null, links: [], price: 349, currency: 'CZK' },
		{ name: 'Hrnek', description: null, links: [], price: 259, currency: 'CZK' },
	];

	const IMPORT_ROWS: GiftDraft[] = [
		{
			name: 'Ponožky z merino vlny',
			description: 'Velikost 42–43',
			links: [{ url: 'https://www.alza.cz' }],
			price: 349,
			currency: 'CZK',
		},
		// Blank name → error row (carries data, not pristine).
		{
			name: '',
			description: null,
			links: [{ url: 'https://www.heureka.cz' }],
			price: null,
			currency: 'CZK',
		},
		// Matches an existing gift → possible-duplicate row.
		{
			name: 'Hrnek s motivem hor',
			description: 'Keramický',
			links: [{ url: 'https://www.heureka.cz' }],
			price: 259,
			currency: 'CZK',
		},
	];

	const EXISTING_GIFTS: ExistingGiftRef[] = [
		{ name: 'Hrnek s motivem hor', links: [{ url: 'https://www.heureka.cz' }] },
	];

	// Single blank-name row that carries data → renders as an error row immediately.
	const SINGLE_BLANK_IMPORT: GiftDraft[] = [
		{
			name: '',
			description: null,
			links: [{ url: 'https://www.heureka.cz' }],
			price: null,
			currency: 'CZK',
		},
	];

	// ── Play functions ───────────────────────────────────────────────────────
	// Storybook may render either locale, so selectors match cs + en variants
	// (matches the project's existing both-locale play-test convention).
	const NAME_LABEL = /^(Name|Název)$/;
	const LINK_1_LABEL = /^(Links|Odkazy) 1$/;
	const ADD_LINK = /^(Add link|Přidat odkaz)$/;
	const REMOVE_LINK = /Remove link|Odebrat odkaz/;
	const SELECT_ALL = /^(Select all|Vybrat vše)$/;
	const SELECT_PONOZKY = /Select row Ponožky|Vybrat řádek Ponožky/;
	const NAME_REQUIRED = /^(Enter a name|Zadejte název)$/;

	const playEditName = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement);
		const nameInput = canvas.getByLabelText(NAME_LABEL);
		await expect(nameInput).toHaveValue('');
		await userEvent.click(nameInput);
		await userEvent.type(nameInput, 'Ponožky z merino vlny');
		await expect(nameInput).toHaveValue('Ponožky z merino vlny');
	};

	const playAddRemoveLink = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement);
		// No link inputs yet — only the "+ link" affordance.
		await expect(canvas.queryByLabelText(LINK_1_LABEL)).not.toBeInTheDocument();

		await userEvent.click(canvas.getByRole('button', { name: ADD_LINK }));
		const linkInput = canvas.getByLabelText(LINK_1_LABEL);
		await expect(linkInput).toBeInTheDocument();

		await userEvent.type(linkInput, 'https://www.alza.cz');
		await expect(linkInput).toHaveValue('https://www.alza.cz');

		await userEvent.click(canvas.getByRole('button', { name: REMOVE_LINK }));
		await expect(canvas.queryByLabelText(LINK_1_LABEL)).not.toBeInTheDocument();
	};

	const playSelectDeselect = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement);
		const selectAll = canvas.getByRole('checkbox', { name: SELECT_ALL });
		const rowPonozky = canvas.getByRole('checkbox', { name: SELECT_PONOZKY });

		// Rows start selected; the header reflects an "all" state.
		await expect(rowPonozky).toHaveAttribute('aria-checked', 'true');
		await expect(selectAll).toHaveAttribute('aria-checked', 'true');

		// Deselect one row → header becomes indeterminate.
		await userEvent.click(rowPonozky);
		await expect(rowPonozky).toHaveAttribute('aria-checked', 'false');
		await expect(selectAll).toHaveAttribute('aria-checked', 'mixed');

		// Select-all re-selects every row.
		await userEvent.click(selectAll);
		await expect(rowPonozky).toHaveAttribute('aria-checked', 'true');
		await expect(selectAll).toHaveAttribute('aria-checked', 'true');
	};

	const playInvalidRow = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement);
		const nameInput = canvas.getByLabelText(NAME_LABEL);
		// Blank-name import row is flagged invalid with a persistent helper.
		await expect(nameInput).toHaveAttribute('aria-invalid', 'true');
		await expect(canvas.getByText(NAME_REQUIRED)).toBeInTheDocument();

		// Typing a name clears the error.
		await userEvent.type(nameInput, 'Termoska');
		await expect(nameInput).toHaveAttribute('aria-invalid', 'false');
		await expect(canvas.queryByText(NAME_REQUIRED)).not.toBeInTheDocument();
	};
</script>

<Story name="Batch (empty)">
	{#snippet template()}
		<div class="mx-auto max-w-5xl p-4">
			<GiftDraftGrid context={DRAFT_GRID_CONTEXT.batch} />
		</div>
	{/snippet}
</Story>

<Story name="Import Review">
	{#snippet template()}
		<div class="mx-auto max-w-5xl p-4">
			<GiftDraftGrid
				context={DRAFT_GRID_CONTEXT.import}
				initialRows={IMPORT_ROWS}
				existingGifts={EXISTING_GIFTS}
			/>
		</div>
	{/snippet}
</Story>

<Story name="Edit name [play: edit]" play={playEditName}>
	{#snippet template()}
		<div class="mx-auto max-w-5xl p-4">
			<GiftDraftGrid context={DRAFT_GRID_CONTEXT.batch} />
		</div>
	{/snippet}
</Story>

<Story name="Add and remove link [play: links]" play={playAddRemoveLink}>
	{#snippet template()}
		<div class="mx-auto max-w-5xl p-4">
			<GiftDraftGrid context={DRAFT_GRID_CONTEXT.batch} initialRows={SINGLE_NAMED} />
		</div>
	{/snippet}
</Story>

<Story name="Select and deselect [play: selection]" play={playSelectDeselect}>
	{#snippet template()}
		<div class="mx-auto max-w-5xl p-4">
			<GiftDraftGrid context={DRAFT_GRID_CONTEXT.batch} initialRows={TWO_NAMED} />
		</div>
	{/snippet}
</Story>

<Story name="Invalid row [play: invalid]" play={playInvalidRow}>
	{#snippet template()}
		<div class="mx-auto max-w-5xl p-4">
			<GiftDraftGrid context={DRAFT_GRID_CONTEXT.import} initialRows={SINGLE_BLANK_IMPORT} />
		</div>
	{/snippet}
</Story>
