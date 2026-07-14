import * as m from '$lib/paraglide/messages.js';

/**
 * OG/Twitter description for a wishlist page.
 *
 * Sentence form „Seznam přání pro {name}" on ALL lists — self and for-someone alike
 * (2026-07-14 header decision). Prose keeps the plain „pro" (no colon); the colon form
 * „Pro: {name}" is header-UI only. Localized via Paraglide.
 */
export function wishlistSocialDescription(
	recipientDisplayName: string,
	options?: { locale?: 'cs' | 'en' },
): string {
	return m.wishlist_og_description_recipient({ recipient: recipientDisplayName }, options);
}
