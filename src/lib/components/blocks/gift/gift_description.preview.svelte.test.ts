import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { expect, it } from 'vitest';
import GiftDescription from './GiftDescription.svelte';

it('previews the latest clarification without clipping interactive history controls', async () => {
	const screen = await render(GiftDescription, {
		description: 'Original description',
		descriptionAppends: [
			{ text: 'Earlier clarification', addedAt: '2026-09-15T12:00:00Z' },
			{ text: 'Latest clarification', addedAt: '2026-09-16T12:00:00Z' },
		],
		preview: true,
		descriptionClass: 'line-clamp-2',
	});
	await expect.element(screen.getByText(/Latest clarification/)).toBeVisible();
	await expect.element(screen.getByText('Original description')).not.toBeInTheDocument();
	await expect.element(screen.getByRole('button')).not.toBeInTheDocument();
});

it('leaves full history accessible outside browse previews', async () => {
	const screen = await render(GiftDescription, {
		description: 'Original description',
		descriptionAppends: [{ text: 'Clarification', addedAt: '2026-09-16T12:00:00Z' }],
	});
	await expect.element(screen.getByText('Original description')).toBeVisible();
	await expect.element(screen.getByText('Clarification', { exact: false })).toBeVisible();
});
