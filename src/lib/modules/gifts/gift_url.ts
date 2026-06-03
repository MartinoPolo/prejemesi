import { MAX_GIFT_LINKS, type GiftLink } from './types.js';

export function normalizeGiftUrl(url: string | null | undefined): string | null {
	if (url === null || url === undefined) {
		return null;
	}

	const trimmedUrl = url.trim();
	if (trimmedUrl === '') {
		return null;
	}

	try {
		const parsedUrl = new URL(trimmedUrl);
		if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
			return null;
		}
		return parsedUrl.toString();
	} catch {
		return null;
	}
}

export function extractGiftUrlDomain(url: string | null): string | null {
	const normalizedUrl = normalizeGiftUrl(url);
	if (normalizedUrl === null) {
		return null;
	}

	return new URL(normalizedUrl).hostname.replace(/^www\./, '');
}

/** The primary link (`links[0]`), or null when the gift has no links. */
export function getPrimaryGiftLink(links: readonly GiftLink[] | null | undefined): GiftLink | null {
	return links && links.length > 0 ? links[0]! : null;
}

/**
 * Sanitize a list of gift links for persistence: drop entries whose URL is not a
 * valid http(s) URL, trim labels (dropping empty ones), and cap the list at
 * {@link MAX_GIFT_LINKS}. Order is preserved so `links[0]` stays primary.
 */
export function normalizeGiftLinks(links: readonly GiftLink[] | null | undefined): GiftLink[] {
	if (!links) {
		return [];
	}

	const normalized: GiftLink[] = [];
	for (const link of links) {
		const url = normalizeGiftUrl(link.url);
		if (url === null) {
			continue;
		}
		const label = link.label?.trim();
		normalized.push(label !== undefined && label !== '' ? { url, label } : { url });
		if (normalized.length >= MAX_GIFT_LINKS) {
			break;
		}
	}
	return normalized;
}
