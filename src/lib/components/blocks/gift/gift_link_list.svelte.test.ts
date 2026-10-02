import '../../../../app.css';
import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import * as m from '$lib/paraglide/messages.js';
import GiftLinkList from './GiftLinkList.svelte';

const hosts: HTMLElement[] = [];

async function renderLinks(props: Record<string, unknown>, palette = 'sky') {
	const host = document.createElement('div');
	host.dataset.palette = palette;
	host.style.width = '320px';
	document.body.append(host);
	hosts.push(host);
	await render(GiftLinkList, props, { baseElement: host });
	return host;
}

function colorOf(className: string, scope: HTMLElement): string {
	const probe = document.createElement('span');
	probe.className = className;
	scope.append(probe);
	const color = getComputedStyle(probe).color;
	probe.remove();
	return color;
}

afterEach(() => {
	for (const host of hosts.splice(0)) {
		host.remove();
	}
});

describe('GiftLinkList source links (issue #442)', () => {
	it.each(['chip', 'row'] as const)(
		'renders %s links as underlined palette text links with a trailing icon',
		async (display) => {
			const host = await renderLinks({
				links: [
					{ url: 'https://www.alza.cz/sluchatka', label: 'Alza' },
					{ url: 'https://shop.example.org/second' },
				],
				display,
			});
			const anchors = host.querySelectorAll<HTMLAnchorElement>('a');
			expect(anchors).toHaveLength(2);

			for (const anchor of anchors) {
				const style = getComputedStyle(anchor);
				expect(anchor.target).toBe('_blank');
				expect(anchor.rel).toContain('noopener');
				expect(style.textDecorationLine).toContain('underline');
				expect(style.color).toBe(colorOf('text-brand-deep', host));
				expect(style.borderTopWidth).toBe('0px');
				expect(style.backgroundColor).toBe('rgba(0, 0, 0, 0)');
				expect(style.paddingLeft).toBe('0px');
				expect(style.boxShadow).toBe('none');
				expect(anchor.lastElementChild?.tagName.toLowerCase()).toBe('svg');
				for (const descendant of anchor.querySelectorAll<HTMLElement>('*')) {
					const descendantStyle = getComputedStyle(descendant);
					expect(descendantStyle.borderTopWidth).toBe('0px');
					expect(descendantStyle.boxShadow).toBe('none');
				}
			}
			expect(anchors[0]!.textContent).toContain('Alza');
			expect(anchors[1]!.textContent).toContain('shop.example.org');
		},
	);

	it('keeps the muted no-link copy for gifts without links', async () => {
		const host = await renderLinks({ links: [] });
		expect(host.querySelector('a')).toBeNull();
		expect(host.textContent).toContain(m.gift_link_none());
	});
});
