import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import AccessGrantRow from './AccessGrantRow.svelte';
import { accessTokenSummary, daysFromNow } from './access_token_test_data.js';

describe('AccessGrantRow', () => {
	it('offers regenerate and revoke for an active token and marks fast-forward', async () => {
		const token = accessTokenSummary({ fastForward: true });
		const onrevoke = vi.fn();
		const screen = await render(AccessGrantRow, { token, onregenerate: vi.fn(), onrevoke });

		await expect
			.element(screen.getByText(m.access_tokens_fast_forward(), { exact: true }).first())
			.toBeVisible();
		await expect
			.element(
				screen.getByRole('button', {
					name: m.access_tokens_regenerate_label({ name: token.name }),
				}),
			)
			.toBeVisible();
		await expect
			.element(
				screen.getByRole('button', {
					name: m.access_tokens_remove_label({ name: token.name }),
				}),
			)
			.not.toBeInTheDocument();
		await expect
			.element(screen.getByText(m.access_tokens_expired_badge(), { exact: true }))
			.not.toBeInTheDocument();

		await screen
			.getByRole('button', { name: m.access_tokens_revoke_label({ name: token.name }) })
			.click();
		expect(onrevoke).toHaveBeenCalledWith(token, expect.any(HTMLElement));
	});

	it('offers removal and regeneration for an expired token', async () => {
		const token = accessTokenSummary({
			expired: true,
			expiresAt: daysFromNow(-4),
			fastForward: true,
		});
		const onregenerate = vi.fn();
		const screen = await render(AccessGrantRow, { token, onregenerate, onrevoke: vi.fn() });

		await expect
			.element(screen.getByText(m.access_tokens_expired_badge(), { exact: true }))
			.toBeVisible();
		await expect
			.element(
				screen.getByRole('button', {
					name: m.access_tokens_remove_label({ name: token.name }),
				}),
			)
			.toBeVisible();
		await expect
			.element(
				screen.getByRole('button', {
					name: m.access_tokens_revoke_label({ name: token.name }),
				}),
			)
			.not.toBeInTheDocument();

		await screen
			.getByRole('button', { name: m.access_tokens_regenerate_label({ name: token.name }) })
			.click();
		expect(onregenerate).toHaveBeenCalledWith(token, expect.any(HTMLElement));
	});
});
