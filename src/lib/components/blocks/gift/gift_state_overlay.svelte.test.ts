import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import * as m from '$lib/paraglide/messages.js';

const { default: GiftStateOverlay } = await import('./GiftStateOverlay.svelte');

describe('GiftStateOverlay', () => {
	it('shows permitted reservation support under Received while a recipient-safe model has no trace', async () => {
		const screen = await render(GiftStateOverlay, {
			model: { kind: 'received', supportKind: 'own-reservation' },
		});
		await expect.element(screen.getByText('Přijato')).toBeVisible();
		await expect.element(screen.getByText('Rezervováno vámi')).toBeVisible();

		await screen.rerender({ model: { kind: 'received' } });
		await expect.element(screen.getByText('Přijato')).toBeVisible();
		expect(document.body.textContent).not.toContain('Rezervováno');
		expect(document.querySelector('[data-reservation-support]')).toBeNull();
	});

	it('shows finite remaining capacity beneath the primary own-reservation state', async () => {
		const screen = await render(GiftStateOverlay, {
			model: {
				kind: 'own-reservation',
				supportKind: 'partial',
				remaining: 2,
				total: 3,
			},
		});

		await expect.element(screen.getByText('Rezervováno vámi')).toBeVisible();
		await expect.element(screen.getByText('Volné 2/3')).toBeVisible();
		await expect.element(screen.getByTestId('gift-state-overlay')).toBeVisible();
		expect(document.querySelector('[role="status"]')).toBeNull();
	});

	it('uses distinct exact ownership copy', async () => {
		const screen = await render(GiftStateOverlay, { model: { kind: 'own-reservation' } });
		await expect.element(screen.getByText('Rezervováno vámi')).toBeVisible();

		await screen.rerender({ model: { kind: 'unavailable' } });
		await expect.element(screen.getByText('Rezervováno někým jiným')).toBeVisible();
	});

	it('provides exact Czech/English translations in static visible text', async () => {
		expect(m.gift_remaining_capacity({ remaining: 2, total: 3 })).toBe('Volné 2/3');
		expect(m.gift_remaining_capacity({ remaining: 2, total: 3 }, { locale: 'en' })).toBe(
			'Available 2/3',
		);
		expect(m.gift_reserved_by_other_overlay({}, { locale: 'en' })).toBe(
			'Reserved by someone else',
		);
		const screen = await render(GiftStateOverlay, {
			model: { kind: 'received', supportKind: 'partial', remaining: 2, total: 3 },
		});

		await expect.element(screen.getByText('Přijato')).toBeVisible();
		await expect.element(screen.getByText('Volné 2/3')).toBeVisible();
		await expect.element(screen.getByTestId('gift-state-overlay')).toBeVisible();
		expect(document.querySelector('[role="status"]')).toBeNull();
	});
});
