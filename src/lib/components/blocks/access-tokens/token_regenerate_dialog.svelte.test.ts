import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import { formatAccessTokenDate } from '$lib/modules/access_tokens/access_token_display.js';
import TokenRegenerateDialog from './TokenRegenerateDialog.svelte';
import { accessTokenSummary, daysFromNow } from './access_token_test_data.js';

describe('TokenRegenerateDialog', () => {
	it("preselects the token's own lifetime and regenerates with it", async () => {
		const onconfirm = vi.fn().mockResolvedValue(undefined);
		await render(TokenRegenerateDialog, {
			open: true,
			token: accessTokenSummary({ expiryPresetDays: 90 }),
			onconfirm,
		});

		const dialog = page.getByRole('dialog', { name: m.access_tokens_regenerate_title() });
		await expect.element(dialog).toBeVisible();
		await expect.element(dialog).toHaveTextContent(m.access_tokens_regenerate_lead());
		await expect
			.element(
				dialog.getByRole('button', { name: m.access_tokens_regenerate_expiry_label() }),
			)
			.toHaveTextContent(m.access_tokens_expiry_90());
		await expect
			.element(
				dialog.getByText(
					m.access_tokens_regenerate_expires_on({
						date: formatAccessTokenDate(daysFromNow(90)),
					}),
				),
			)
			.toBeVisible();

		await dialog.getByRole('button', { name: m.access_tokens_regenerate() }).click();
		expect(onconfirm).toHaveBeenCalledWith(90);
	});

	it('explains that an expired token already stopped working', async () => {
		await render(TokenRegenerateDialog, {
			open: true,
			token: accessTokenSummary({
				expired: true,
				expiresAt: daysFromNow(-4),
				expiryPresetDays: 30,
			}),
			onconfirm: vi.fn(),
		});

		const dialog = page.getByRole('dialog', {
			name: m.access_tokens_regenerate_expired_title(),
		});
		await expect.element(dialog).toBeVisible();
		await expect.element(dialog).toHaveTextContent(m.access_tokens_regenerate_expired_lead());
		await expect
			.element(
				dialog.getByRole('button', { name: m.access_tokens_regenerate_expiry_label() }),
			)
			.toHaveTextContent(m.access_tokens_expiry_30());
	});
});
