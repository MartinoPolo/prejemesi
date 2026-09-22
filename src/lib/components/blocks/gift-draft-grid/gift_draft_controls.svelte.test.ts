import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import { DRAFT_PRIORITY } from '$lib/modules/gifts/types.js';
import { createPixelAssertions } from '../../../../../tests/helpers/pixel-assertions.mjs';
import GiftDraftLinksCell from './GiftDraftLinksCell.svelte';
import GiftDraftPriorityCell from './GiftDraftPriorityCell.svelte';

const { expectPixelsNear } = createPixelAssertions(expect);

describe('gift draft dense controls', () => {
	it('toggles priority through an accessible shared-size control', async () => {
		const onchange = vi.fn();
		const screen = render(GiftDraftPriorityCell, {
			priority: DRAFT_PRIORITY.medium,
			name: 'Kniha',
			onchange,
		});
		const priority = screen.getByRole('checkbox', {
			name: m.draft_grid_priority_toggle({ name: 'Kniha' }),
		});

		expectPixelsNear(priority.element().getBoundingClientRect().height, 26);
		await expect.element(priority).toHaveAttribute('aria-checked', 'false');
		await priority.click();
		expect(onchange).toHaveBeenCalledWith(DRAFT_PRIORITY.high);
	});

	it('keeps external and remove link actions equal while removing the selected link', async () => {
		const onchange = vi.fn();
		const links = [{ url: 'example.com/kniha', label: 'Kniha' }];
		const screen = render(GiftDraftLinksCell, { links, onchange });
		const openLink = screen.getByRole('link', {
			name: m.draft_grid_open_link({ label: 'Kniha' }),
		});
		const removeLink = screen.getByRole('button', {
			name: m.draft_grid_remove_link({ label: 'Kniha' }),
		});

		expectPixelsNear(openLink.element().getBoundingClientRect().height, 26);
		expectPixelsNear(removeLink.element().getBoundingClientRect().height, 26);
		await expect.element(openLink).toHaveAttribute('href', 'https://example.com/kniha');
		await removeLink.click();
		expect(links).toHaveLength(0);
		expect(onchange).toHaveBeenCalledOnce();
	});
});
