import { MAX_GIFT_LINKS, type GiftLink } from './types.js';

/** A valid hostname has only alphanumeric labels separated by dots, with at least one dot. */
const VALID_HOSTNAME_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

export function normalizeGiftUrl(url: string | null | undefined): string | null {
	if (url === null || url === undefined) {
		return null;
	}

	const trimmedUrl = url.trim();
	if (trimmedUrl === '') {
		return null;
	}

	const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmedUrl);
	const withProtocol = hasScheme ? trimmedUrl : `https://${trimmedUrl}`;

	try {
		const parsedUrl = new URL(withProtocol);
		if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
			return null;
		}
		if (!VALID_HOSTNAME_RE.test(parsedUrl.hostname)) {
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

/** Canonical host+path identity used by duplicate advisories (query/hash are ignored). */
export function canonicalGiftLinkKey(url: string | null | undefined): string | null {
	const normalizedUrl = normalizeGiftUrl(url);
	if (normalizedUrl === null) {
		return null;
	}
	const parsed = new URL(normalizedUrl);
	const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
	const path = parsed.pathname.replace(/\/$/, '');
	return `${host}${path}`;
}

/** Authoritative source identity for ingestion idempotency, including every query parameter. */
export function canonicalIngestionSourceKey(url: string | null | undefined): string | null {
	const normalizedUrl = normalizeGiftUrl(url);
	if (normalizedUrl === null) {
		return null;
	}
	const parsed = new URL(normalizedUrl);
	const host = parsed.host.toLowerCase().replace(/^www\./, '');
	const path = parsed.pathname.replace(/\/$/, '');
	const queryEntries = [...parsed.searchParams.entries()].sort(
		([leftKey, leftValue], [rightKey, rightValue]) => {
			if (leftKey !== rightKey) {
				return leftKey < rightKey ? -1 : 1;
			}
			return leftValue === rightValue ? 0 : leftValue < rightValue ? -1 : 1;
		},
	);
	const query = new URLSearchParams(queryEntries).toString();
	return `${host}${path}${query === '' ? '' : `?${query}`}`;
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
/**
 * Generate a stable client-only id for a gift link (editor list key). Monotonic
 * counter – unique within a session, never persisted.
 */
let nextGiftLinkId = 0;
export function createGiftLinkId(): string {
	nextGiftLinkId += 1;
	return `gift-link-${nextGiftLinkId}`;
}

/**
 * Ensure every link carries a stable {@link GiftLink.id} for editor reconciliation.
 * Links arriving from the server lack one; this assigns ids without mutating input.
 */
export function ensureGiftLinkIds(links: readonly GiftLink[] | null | undefined): GiftLink[] {
	if (!links) {
		return [];
	}
	return links.map((link) =>
		link.id !== undefined ? link : { ...link, id: createGiftLinkId() },
	);
}

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
