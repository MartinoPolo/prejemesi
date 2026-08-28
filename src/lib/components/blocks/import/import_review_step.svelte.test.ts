import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import type { ValidatedGiftDraft } from '$lib/modules/gifts/gift_draft.js';
import { WIZARD_MODE } from './import_wizard_types.js';

vi.mock('$env/dynamic/public', () => ({ env: {} }));

const { default: ImportReviewStep } = await import('./ImportReviewStep.svelte');

interface ReadyPayload {
	drafts: ValidatedGiftDraft[];
	title?: string;
}

function latestReady(onready: ReturnType<typeof vi.fn>): ReadyPayload {
	return onready.mock.calls.at(-1)?.[0] as ReadyPayload;
}

describe('ImportReviewStep readiness', () => {
	it('clears previously ready drafts when a later selected edit blocks the batch', async () => {
		const onready = vi.fn();
		const screen = await render(ImportReviewStep, {
			parsedRows: [
				['Name', 'Quantity'],
				['Kniha', '1'],
				['Hrnek', '2'],
			],
			mode: WIZARD_MODE.append,
			onready,
		});

		await vi.waitFor(() => expect(latestReady(onready).drafts).toHaveLength(2));

		await screen
			.getByRole('spinbutton', { name: m.draft_grid_col_quantity() })
			.nth(1)
			.fill('0');
		await vi.waitFor(() => expect(latestReady(onready).drafts).toEqual([]));

		await screen
			.getByRole('spinbutton', { name: m.draft_grid_col_quantity() })
			.nth(1)
			.fill('3');
		await vi.waitFor(() => expect(latestReady(onready).drafts).toHaveLength(2));
	});

	it('keeps import review deletion controls without exposing batch insertion', async () => {
		const screen = await render(ImportReviewStep, {
			parsedRows: [
				['Name', 'Quantity'],
				['Kniha', '1'],
			],
			mode: WIZARD_MODE.append,
			onready: vi.fn(),
		});

		await expect
			.element(screen.getByRole('button', { name: m.draft_grid_remove_row() }).first())
			.toBeVisible();
		await expect
			.element(screen.getByRole('button', { name: m.draft_grid_add_row() }))
			.not.toBeInTheDocument();
	});
});
