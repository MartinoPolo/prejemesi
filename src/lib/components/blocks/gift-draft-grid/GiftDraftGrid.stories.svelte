<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, userEvent, within, waitFor } from 'storybook/test';
	import { GiftDraftGrid } from './index.js';
	import type { GiftDraft } from '$lib/modules/gifts/gift_draft.js';
	import { DEFAULT_GIFT_CURRENCY } from '$lib/modules/gifts/types.js';

	const { Story } = defineMeta({
		title: 'Blocks/GiftDraftGrid',
		component: GiftDraftGrid,
		tags: ['autodocs'],
	});

	const sampleDrafts: GiftDraft[] = [
		{
			name: 'Ponožky z merino vlny',
			description: 'Velikost 42–43, tmavě modré',
			links: [{ url: 'https://www.alza.cz/ponozky' }, { url: 'https://www.lidl.cz/ponozky' }],
			price: 349,
			currency: 'CZK',
		},
		{
			name: '',
			description: null,
			links: [{ url: 'https://www.heureka.cz/produkt' }],
			price: null,
			currency: DEFAULT_GIFT_CURRENCY,
		},
		{
			name: 'Hrnek s motivem hor',
			description: 'Keramický, 0,4 l',
			links: [{ url: 'https://www.heureka.cz/hrnek' }],
			price: 259,
			currency: 'CZK',
		},
		{
			name: 'Kniha Atomové návyky',
			description: 'James Clear, vázaná. Český překlad, 2. vydání.',
			links: [{ url: 'https://www.knihy-dobrovsky.cz/atomove-navyky' }],
			price: 299,
			currency: 'CZK',
		},
	];

	const existingGifts = [{ name: 'Hrnek s motivem hor', links: null }];

	const emptyDraft: GiftDraft = {
		name: '',
		description: null,
		links: [],
		price: null,
		currency: DEFAULT_GIFT_CURRENCY,
	};

	// ── Play functions ──────────────────────────────────────

	const playEditName = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement);
		const rows = canvas.getAllByTestId('draft-row');
		const errorRow = rows[1];
		await expect(errorRow).toHaveAttribute('data-status', 'error');

		const nameInput = within(errorRow).getByPlaceholderText('Zadejte název');
		await userEvent.clear(nameInput);
		await userEvent.type(nameInput, 'Nový dárek');

		await waitFor(() => {
			expect(errorRow).toHaveAttribute('data-status', 'ready');
		});
	};

	const playClearName = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement);
		const rows = canvas.getAllByTestId('draft-row');
		const readyRow = rows[0];
		await expect(readyRow).toHaveAttribute('data-status', 'ready');

		const nameInput = within(readyRow).getByDisplayValue('Ponožky z merino vlny');
		await userEvent.clear(nameInput);

		await waitFor(() => {
			expect(readyRow).toHaveAttribute('data-status', 'error');
		});
		const helpText = within(readyRow).getByText('Zadejte název');
		await expect(helpText).toBeInTheDocument();
	};

	const playAddLink = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement);
		const rows = canvas.getAllByTestId('draft-row');
		const row = rows[0];

		const addLinkButtons = within(row).getAllByText('odkaz');
		const addLinkButton = addLinkButtons[addLinkButtons.length - 1];
		await userEvent.click(addLinkButton);

		const urlInput = within(row).getByPlaceholderText('https://...');
		await userEvent.type(urlInput, 'https://www.amazon.com/test');
		await userEvent.keyboard('{Enter}');

		await waitFor(() => {
			const links = within(row).getAllByRole('link');
			expect(links.length).toBe(3);
		});
	};

	const playRemoveLink = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement);
		const rows = canvas.getAllByTestId('draft-row');
		const row = rows[0];

		const linksBefore = within(row).getAllByRole('link');
		const initialCount = linksBefore.length;

		const removeButtons = within(row).getAllByLabelText(/Odebrat odkaz/);
		await userEvent.click(removeButtons[0]);

		await waitFor(() => {
			const linksAfter = within(row).getAllByRole('link');
			expect(linksAfter.length).toBe(initialCount - 1);
		});
	};

	const playSelectDeselect = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement);
		const rows = canvas.getAllByTestId('draft-row');
		const row = rows[0];

		await expect(row).toHaveAttribute('data-excluded', 'false');

		const checkbox = within(row).getByRole('checkbox');
		await userEvent.click(checkbox);

		await waitFor(() => {
			expect(row).toHaveAttribute('data-excluded', 'true');
		});

		await userEvent.click(checkbox);

		await waitFor(() => {
			expect(row).toHaveAttribute('data-excluded', 'false');
		});
	};

	const playInvalidRow = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement);
		const rows = canvas.getAllByTestId('draft-row');
		const errorRow = rows[1];

		await expect(errorRow).toHaveAttribute('data-status', 'error');
		const helpText = within(errorRow).getByText('Zadejte název');
		await expect(helpText).toBeInTheDocument();
	};

	const playBulkDelete = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement);
		const rowsBefore = canvas.getAllByTestId('draft-row');
		const initialCount = rowsBefore.length;

		const deleteButton = canvas.getByText('Smazat vybrané');
		await userEvent.click(deleteButton);

		await waitFor(() => {
			const rowsAfter = canvas.queryAllByTestId('draft-row');
			expect(rowsAfter.length).toBeLessThan(initialCount);
		});
	};

	const playCurrencySelect = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement);
		const currencySelects = canvas.getAllByLabelText('Měna');
		const firstSelect = currencySelects[0] as HTMLSelectElement;

		await expect(firstSelect.value).toBe('CZK');
		await userEvent.selectOptions(firstSelect, 'EUR');
		await expect(firstSelect.value).toBe('EUR');
	};
</script>

<Story
	name="Import Mode (All States)"
	args={{ initialDrafts: sampleDrafts, existingGifts, mode: 'import' }}
>
	{#snippet template(args)}
		<div class="mx-auto max-w-5xl p-6">
			<GiftDraftGrid {...args} />
		</div>
	{/snippet}
</Story>

<Story name="Batch Mode" args={{ initialDrafts: [emptyDraft], existingGifts: [], mode: 'batch' }}>
	{#snippet template(args)}
		<div class="mx-auto max-w-5xl p-6">
			<GiftDraftGrid {...args} />
		</div>
	{/snippet}
</Story>

<Story
	name="Edit Name [play]"
	play={playEditName}
	args={{ initialDrafts: sampleDrafts, existingGifts, mode: 'import' }}
>
	{#snippet template(args)}
		<div class="mx-auto max-w-5xl p-6">
			<GiftDraftGrid {...args} />
		</div>
	{/snippet}
</Story>

<Story
	name="Clear Name Shows Error [play]"
	play={playClearName}
	args={{ initialDrafts: sampleDrafts, existingGifts: [], mode: 'import' }}
>
	{#snippet template(args)}
		<div class="mx-auto max-w-5xl p-6">
			<GiftDraftGrid {...args} />
		</div>
	{/snippet}
</Story>

<Story
	name="Add Link [play]"
	play={playAddLink}
	args={{ initialDrafts: sampleDrafts, existingGifts: [], mode: 'import' }}
>
	{#snippet template(args)}
		<div class="mx-auto max-w-5xl p-6">
			<GiftDraftGrid {...args} />
		</div>
	{/snippet}
</Story>

<Story
	name="Remove Link [play]"
	play={playRemoveLink}
	args={{ initialDrafts: sampleDrafts, existingGifts: [], mode: 'import' }}
>
	{#snippet template(args)}
		<div class="mx-auto max-w-5xl p-6">
			<GiftDraftGrid {...args} />
		</div>
	{/snippet}
</Story>

<Story
	name="Select / Deselect [play]"
	play={playSelectDeselect}
	args={{ initialDrafts: sampleDrafts, existingGifts: [], mode: 'import' }}
>
	{#snippet template(args)}
		<div class="mx-auto max-w-5xl p-6">
			<GiftDraftGrid {...args} />
		</div>
	{/snippet}
</Story>

<Story
	name="Invalid Row [play]"
	play={playInvalidRow}
	args={{ initialDrafts: sampleDrafts, existingGifts: [], mode: 'import' }}
>
	{#snippet template(args)}
		<div class="mx-auto max-w-5xl p-6">
			<GiftDraftGrid {...args} />
		</div>
	{/snippet}
</Story>

<Story
	name="Bulk Delete [play]"
	play={playBulkDelete}
	args={{ initialDrafts: sampleDrafts, existingGifts: [], mode: 'import' }}
>
	{#snippet template(args)}
		<div class="mx-auto max-w-5xl p-6">
			<GiftDraftGrid {...args} />
		</div>
	{/snippet}
</Story>

<Story
	name="Currency Select [play]"
	play={playCurrencySelect}
	args={{ initialDrafts: sampleDrafts, existingGifts: [], mode: 'import' }}
>
	{#snippet template(args)}
		<div class="mx-auto max-w-5xl p-6">
			<GiftDraftGrid {...args} />
		</div>
	{/snippet}
</Story>

<Story name="With Duplicates" args={{ initialDrafts: sampleDrafts, existingGifts, mode: 'import' }}>
	{#snippet template(args)}
		<div class="mx-auto max-w-5xl p-6">
			<p class="mb-4 text-xs text-foreground-muted">
				Row "Hrnek s motivem hor" matches an existing gift — orange duplicate tint + badge.
			</p>
			<GiftDraftGrid {...args} />
		</div>
	{/snippet}
</Story>
