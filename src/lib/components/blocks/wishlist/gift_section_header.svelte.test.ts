import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import { GIFT_SECTION_KINDS, type GiftSection } from '$lib/modules/gifts/gift_ordering.js';
import GiftSectionHeader from './GiftSectionHeader.svelte';

function section(kind: GiftSection['kind'], label: string | null = null): GiftSection {
	return { kind, key: `${kind}:${label ?? ''}`, label, gifts: [] };
}

describe('GiftSectionHeader copy (issue #224 follow-up)', () => {
	it('renders the „other gifts" header for the band after the own-reservation band', async () => {
		const screen = await render(GiftSectionHeader, {
			section: section(GIFT_SECTION_KINDS.otherGifts),
		});

		await expect
			.element(screen.getByRole('heading', { name: m.gift_band_other_gifts() }))
			.toBeInTheDocument();
		await screen.unmount();
	});

	it('renders the own-reservation header for the own-reservation band', async () => {
		const screen = await render(GiftSectionHeader, {
			section: section(GIFT_SECTION_KINDS.ownReservation),
		});

		await expect
			.element(screen.getByRole('heading', { name: m.gift_band_own_reservations() }))
			.toBeInTheDocument();
		await screen.unmount();
	});

	it('renders shared no-value and manager-provided group headers', async () => {
		const uncategorized = await render(GiftSectionHeader, {
			section: section(GIFT_SECTION_KINDS.uncategorized),
		});
		await expect
			.element(uncategorized.getByRole('heading', { name: m.gift_category_uncategorized() }))
			.toBeInTheDocument();
		await uncategorized.unmount();

		const category = await render(GiftSectionHeader, {
			section: section(GIFT_SECTION_KINDS.categoryGroup, 'Knihy'),
		});
		await expect.element(category.getByRole('heading', { name: 'Knihy' })).toBeInTheDocument();
		await category.unmount();
	});
});
