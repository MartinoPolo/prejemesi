import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import TokenRevealPanel from './TokenRevealPanel.svelte';
import { accessTokenSummary } from './access_token_test_data.js';

const TOKEN_VALUE = 'pjs_7Kq2Lm7Rt4vWc8NzKp3Hd6YbJs1Ae5G';

function renderPanel(props: { replacedPrefix?: string | null; oncopied?: () => void } = {}) {
	return render(TokenRevealPanel, {
		created: { token: accessTokenSummary(), value: TOKEN_VALUE },
		apiBaseUrl: 'https://prejemesi.cz/api/v1',
		oncopied: props.oncopied ?? vi.fn(),
		replacedPrefix: props.replacedPrefix ?? null,
	});
}

describe('TokenRevealPanel', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('warns that the value is shown once and offers it read-only', async () => {
		const screen = await renderPanel();

		await expect
			.element(screen.getByRole('alert'))
			.toHaveTextContent(m.access_tokens_shown_once());
		const value = screen.getByLabelText(m.access_tokens_value_label());
		await expect.element(value).toHaveValue(TOKEN_VALUE);
		await expect.element(value).toHaveAttribute('readonly');
	});

	it('tells a regeneration that the old value stopped working', async () => {
		const screen = await renderPanel({ replacedPrefix: 'pjs_c9Te' });

		await expect
			.element(screen.getByText(m.access_tokens_replaced_note({ prefix: 'pjs_c9Te…' })))
			.toBeVisible();
	});

	it('copies the full value and confirms it on the button', async () => {
		const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
		const oncopied = vi.fn();
		const screen = await renderPanel({ oncopied });

		await screen.getByRole('button', { name: m.access_tokens_copy() }).click();

		expect(writeText).toHaveBeenCalledWith(TOKEN_VALUE);
		await expect
			.element(screen.getByRole('button', { name: m.access_tokens_copied() }))
			.toBeVisible();
		expect(oncopied).toHaveBeenCalledOnce();
	});

	it('selects the value for a manual copy when the clipboard refuses', async () => {
		vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
		const oncopied = vi.fn();
		const screen = await renderPanel({ oncopied });

		await screen.getByRole('button', { name: m.access_tokens_copy() }).click();

		const input = screen
			.getByLabelText(m.access_tokens_value_label())
			.element() as HTMLInputElement;
		await vi.waitFor(() => {
			expect(input.selectionStart).toBe(0);
			expect(input.selectionEnd).toBe(TOKEN_VALUE.length);
		});
		expect(oncopied).not.toHaveBeenCalled();
		await expect
			.element(screen.getByRole('button', { name: m.access_tokens_copy() }))
			.toBeVisible();
	});
});
