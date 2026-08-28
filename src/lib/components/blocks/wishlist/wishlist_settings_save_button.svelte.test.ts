import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import WishlistSettingsSaveButton, {
	PENDING_INDICATOR_DELAY_MS,
} from './WishlistSettingsSaveButton.svelte';

describe('WishlistSettingsSaveButton', () => {
	it('locks immediately but only shows pending feedback for a slower save', async () => {
		const screen = render(WishlistSettingsSaveButton, {
			form: 'test-form',
			dirty: true,
			saving: true,
		});
		const save = screen.getByRole('button', { name: m.save() });

		await expect.element(save).toBeDisabled();
		await expect.element(save).toHaveAttribute('aria-busy', 'true');
		await expect.element(screen.getByTestId('save-pending-indicator')).not.toBeInTheDocument();

		await new Promise((resolve) => setTimeout(resolve, PENDING_INDICATOR_DELAY_MS + 50));
		await expect.element(screen.getByTestId('save-pending-indicator')).toBeVisible();
	});

	it('never flashes pending feedback when saving finishes before the delay', async () => {
		const screen = render(WishlistSettingsSaveButton, {
			form: 'test-form',
			dirty: true,
			saving: true,
		});
		const save = screen.getByRole('button', { name: m.save() });

		await screen.rerender({ saving: false });
		await new Promise((resolve) => setTimeout(resolve, PENDING_INDICATOR_DELAY_MS + 50));

		await expect.element(screen.getByTestId('save-pending-indicator')).not.toBeInTheDocument();
		await expect.element(save).toBeEnabled();
		await expect.element(save).toHaveAttribute('aria-busy', 'false');
	});
});
