import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import { DRAFT_GRID_CONTEXT, type DraftGridChange } from './gift_draft_grid_model.js';

vi.mock('$env/dynamic/public', () => ({ env: {} }));

const { default: GiftDraftGrid } = await import('./GiftDraftGrid.svelte');

function draft(name: string, quantity = 1) {
	return {
		name,
		description: null,
		links: [],
		price: null,
		currency: 'CZK' as const,
		imageUrl: null,
		quantity,
		priority: 'medium' as const,
	};
}

function latestChange(onchange: ReturnType<typeof vi.fn>): DraftGridChange {
	return onchange.mock.calls.at(-1)?.[0] as DraftGridChange;
}

describe('GiftDraftGrid submission gate', () => {
	it('blocks a mixed selected batch until the invalid row is corrected', async () => {
		const onchange = vi.fn();
		const screen = await render(GiftDraftGrid, {
			initialRows: [draft('Kniha'), draft('Hrnek', 0)],
			onchange,
		});

		await vi.waitFor(() => expect(onchange).toHaveBeenCalled());
		expect(latestChange(onchange)).toMatchObject({
			validCount: 1,
			selectedCount: 2,
			blockingCount: 1,
		});

		await screen
			.getByRole('spinbutton', { name: m.draft_grid_col_quantity() })
			.nth(1)
			.fill('2');
		await vi.waitFor(() => expect(latestChange(onchange).blockingCount).toBe(0));
		expect(latestChange(onchange)).toMatchObject({
			validCount: 2,
			selectedCount: 2,
			blockingCount: 0,
		});
	});

	it('blocks an unresolved duplicate until its badge is dismissed', async () => {
		const onchange = vi.fn();
		const duplicateDraft = {
			...draft('Stejný hrnek'),
			links: [{ url: 'https://example.com/hrnek?new=1' }],
		};
		const screen = await render(GiftDraftGrid, {
			props: {
				context: DRAFT_GRID_CONTEXT.import,
				initialRows: [duplicateDraft],
				existingGifts: [
					{ name: 'Stejný hrnek', links: [{ url: 'https://example.com/hrnek?old=1' }] },
				],
				onchange,
			},
		});

		await vi.waitFor(() => expect(onchange).toHaveBeenCalled());
		expect(latestChange(onchange)).toMatchObject({ validCount: 0, blockingCount: 1 });

		await screen.getByRole('button', { name: m.draft_grid_duplicate_badge() }).click();
		await vi.waitFor(() => expect(latestChange(onchange).blockingCount).toBe(0));
		expect(latestChange(onchange)).toMatchObject({ validCount: 1, blockingCount: 0 });
	});
});
