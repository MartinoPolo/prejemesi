import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

afterEach(async () => page.viewport(1280, 720));

describe('ImportReviewStep readiness', () => {
	it('uses responsive sizing for column mapping and category resolution triggers', async () => {
		const host = document.createElement('div');
		document.body.appendChild(host);
		await render(
			ImportReviewStep,
			{
				parsedRows: [
					['Name', 'Category'],
					['Kniha', 'Unknown category'],
				],
				mode: WIZARD_MODE.append,
				categoryOptions: [
					{
						id: 'existing-category',
						presetKey: null,
						customLabel: 'Existing category',
						color: '#2563EB',
						sortOrder: 0,
						usedCount: 1,
					},
				],
				onready: vi.fn(),
			},
			{ baseElement: host },
		);

		await vi.waitFor(() => {
			expect(
				host.querySelectorAll('[data-slot="alert"] [data-slot="select-trigger"]'),
			).toHaveLength(1);
		});
		const mappingTriggers = [
			...host.querySelectorAll<HTMLElement>('[data-slot="select-trigger"]'),
		].slice(0, 7);
		const resolutionTrigger = host.querySelector<HTMLElement>(
			'[data-slot="alert"] [data-slot="select-trigger"]',
		)!;
		const triggers = [...mappingTriggers, resolutionTrigger];

		await page.viewport(390, 720);
		for (const trigger of triggers) {
			expect(trigger.getBoundingClientRect().height).toBe(40);
		}

		await page.viewport(1280, 720);
		for (const trigger of triggers) {
			expect(trigger.getBoundingClientRect().height).toBe(32);
		}
	});
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
