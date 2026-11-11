import type { getDomain } from 'tldts';
import { normalizeGiftUrl } from './gift_url.js';

/**
 * tldts `getDomain`. Its public suffix list is too heavy to evaluate on the Worker within
 * the cold-start CPU budget, so callers load it in the browser and pass it in; only type
 * imports of tldts belong in modules the server or SSR can reach.
 */
export type RegistrableDomainResolver = typeof getDomain;

/**
 * The store a gift link points to: its registrable domain, so subdomains merge
 * (`eshop.decathlon.cz` → `decathlon.cz`) and multi-part suffixes stay whole
 * (`shop.example.co.uk` → `example.co.uk`). A host without a registrable domain,
 * such as an IP address, is its own store; an invalid URL has none.
 */
export function extractGiftStoreDomain(
	url: string | null | undefined,
	resolveRegistrableDomain: RegistrableDomainResolver,
): string | null {
	const normalizedUrl = normalizeGiftUrl(url);
	if (normalizedUrl === null) {
		return null;
	}

	const hostname = new URL(normalizedUrl).hostname;
	return resolveRegistrableDomain(hostname, { allowPrivateDomains: true }) ?? hostname;
}
