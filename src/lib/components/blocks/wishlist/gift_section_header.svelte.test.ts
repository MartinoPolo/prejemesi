import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import { overwriteGetLocale } from '$lib/paraglide/runtime.js';
import { GIFT_SECTION_KINDS, type GiftSection } from '$lib/modules/gifts/gift_ordering.js';
import type { PriorityKey } from '$lib/modules/gifts/gift_display.js';
import GiftSectionHeader from './GiftSectionHeader.svelte';

function section(
	kind: GiftSection['kind'],
	label: string | null = null,
	priorityKey: PriorityKey | null = null,
): GiftSection {
	return { kind, key: `${kind}:${label ?? ''}`, label, priorityKey, gifts: [] };
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

	it('localizes default priority headings in Czech and English', async () => {
		overwriteGetLocale(() => 'cs');
		const czech = await render(GiftSectionHeader, {
			section: section(GIFT_SECTION_KINDS.priorityGroup, 'Vysoka', 'Vysoka'),
		});
		await expect.element(czech.getByRole('heading', { name: 'Vysoká' })).toBeInTheDocument();
		await czech.unmount();

		overwriteGetLocale(() => 'en');
		const english = await render(GiftSectionHeader, {
			section: section(GIFT_SECTION_KINDS.priorityGroup, 'Vysoka', 'Vysoka'),
		});
		await expect.element(english.getByRole('heading', { name: 'High' })).toBeInTheDocument();
		await english.unmount();
		overwriteGetLocale(() => 'cs');
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
