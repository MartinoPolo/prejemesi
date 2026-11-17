import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import type { ComponentProps } from 'svelte';
import * as m from '$lib/paraglide/messages.js';
import GiftLinkRow from './GiftLinkRow.svelte';

const defaultProps: ComponentProps<typeof GiftLinkRow> = {
	link: { url: '', label: undefined },
	rowKey: 'gift-link-test',
	position: 1,
	isExpanded: true,
	canReorder: false,
	ontoggle: () => {},
	oncollapse: () => {},
	onurlchange: () => {},
	onlabelchange: () => {},
	onremove: () => {},
	ongrippointerdown: () => {},
	ongripkeydown: () => {},
};

async function renderRow(overrides: Partial<ComponentProps<typeof GiftLinkRow>> = {}) {
	const list = document.createElement('ul');
	document.body.append(list);
	return render(GiftLinkRow, { props: { ...defaultProps, ...overrides }, target: list });
}

describe('GiftLinkRow label placeholder previews the auto-derived domain', () => {
	it('shows the URL domain as the placeholder when the label is empty', async () => {
		const screen = await renderRow({
			link: { url: 'https://www.alza.cz/playstation-5', label: undefined },
		});

		await expect
			.element(screen.getByLabelText(m.gift_link_visible_label()))
			.toHaveAttribute('placeholder', 'alza.cz');
	});

	it('falls back to the generic hint when the URL is empty', async () => {
		const screen = await renderRow({ link: { url: '', label: undefined } });

		await expect
			.element(screen.getByLabelText(m.gift_link_visible_label()))
			.toHaveAttribute('placeholder', m.gift_link_label_placeholder());
	});
});
