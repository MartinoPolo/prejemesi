import { extractGiftUrlDomain } from '$lib/modules/gifts/gift_url.js';
import type { GiftLink } from '$lib/modules/gifts/types.js';

/**
 * How a collapsed editor row shows a link on one line: the address without its scheme, with the
 * visible label (custom, or the derived domain) highlighted where the address contains it, or as a
 * chip before the address where it does not.
 */
export type GiftLinkLine =
	| { kind: 'highlighted'; beforeLabel: string; label: string; afterLabel: string }
	| { kind: 'labelled'; label: string; address: string }
	| { kind: 'address'; address: string };

export function giftLinkLine(link: Pick<GiftLink, 'url' | 'label'>): GiftLinkLine {
	const address = link.url.trim().replace(/^https?:\/\//i, '');
	const customLabel = link.label?.trim() ?? '';
	const label = customLabel !== '' ? customLabel : (extractGiftUrlDomain(link.url) ?? '');
	if (label === '') {
		return { kind: 'address', address };
	}
	const labelStart = address.toLowerCase().indexOf(label.toLowerCase());
	if (labelStart < 0) {
		return { kind: 'labelled', label, address };
	}
	const labelEnd = labelStart + label.length;
	return {
		kind: 'highlighted',
		beforeLabel: address.slice(0, labelStart),
		label: address.slice(labelStart, labelEnd),
		afterLabel: address.slice(labelEnd),
	};
}
