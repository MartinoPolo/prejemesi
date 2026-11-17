import { describe, expect, it } from 'vitest';
import { giftLinkLine } from './gift_link_line.js';

describe('giftLinkLine', () => {
	it('highlights a custom label where the address contains it, ignoring case', () => {
		expect(giftLinkLine({ url: 'https://www.hudy.cz/osprey-talon-22', label: 'Hudy' })).toEqual(
			{
				kind: 'highlighted',
				beforeLabel: 'www.',
				label: 'hudy',
				afterLabel: '.cz/osprey-talon-22',
			},
		);
	});

	it('highlights the derived domain when the link has no custom label', () => {
		expect(giftLinkLine({ url: 'https://www.alza.cz/playstation-5' })).toEqual({
			kind: 'highlighted',
			beforeLabel: 'www.',
			label: 'alza.cz',
			afterLabel: '/playstation-5',
		});
	});

	it('shows a custom label missing from the address as a chip before it', () => {
		expect(
			giftLinkLine({
				url: 'https://www.eshop-novak.cz/batohy/osprey',
				label: 'Obchod u Nováků',
			}),
		).toEqual({
			kind: 'labelled',
			label: 'Obchod u Nováků',
			address: 'www.eshop-novak.cz/batohy/osprey',
		});
	});

	it('treats a blank custom label as no label', () => {
		expect(giftLinkLine({ url: 'alza.cz/darek', label: '   ' })).toMatchObject({
			kind: 'highlighted',
			label: 'alza.cz',
		});
	});

	it('shows an invalid address as plain text', () => {
		expect(giftLinkLine({ url: 'not a link' })).toEqual({
			kind: 'address',
			address: 'not a link',
		});
	});
});
