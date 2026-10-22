import * as m from '$lib/paraglide/messages.js';
import { SITE_URL } from '$lib/config/site.js';
import { SOCIAL_PREVIEW_IMAGE } from '$lib/config/social_preview.js';
import {
	wishlistSocialImage,
	type SocialPreviewImage,
} from '$lib/modules/images/wishlist_slots.js';
import type { WishlistImageSlots } from '$lib/modules/images/types.js';
import { wishlistSocialDescription } from './social_description.js';

type SocialLocale = 'cs' | 'en';

const OPEN_GRAPH_LOCALES: Record<SocialLocale, string> = { cs: 'cs_CZ', en: 'en_US' };

interface SocialPreview {
	title: string;
	description: string;
	/** Absolute canonical URL of the shared page. */
	url: string;
	image: SocialPreviewImage;
	imageAlt: string;
	locale: SocialLocale;
}

/** One `<meta>` element: Open Graph uses `property`, Twitter cards use `name`. */
export interface SocialMetaTag {
	property?: string;
	name?: string;
	content: string;
}

export interface WishlistSocialSource {
	shortId: string;
	title: string;
	recipientDisplayName: string;
	imageKey: string | null | undefined;
	imageSlots: WishlistImageSlots | null | undefined;
}

function socialLocale(locale: string): SocialLocale {
	return locale.startsWith('en') ? 'en' : 'cs';
}

/**
 * Open Graph and Twitter card tags for a shared page. Facebook, Messenger, WhatsApp
 * and Telegram read the Open Graph set; X reads the Twitter set.
 */
function buildSocialMetaTags(preview: SocialPreview): SocialMetaTag[] {
	const otherLocale: SocialLocale = preview.locale === 'cs' ? 'en' : 'cs';
	const { image } = preview;
	const imageDimensionTags: SocialMetaTag[] =
		image.width !== undefined && image.height !== undefined
			? [
					{ property: 'og:image:width', content: String(image.width) },
					{ property: 'og:image:height', content: String(image.height) },
				]
			: [];

	return [
		{ property: 'og:site_name', content: m.app_name({}, { locale: preview.locale }) },
		{ property: 'og:locale', content: OPEN_GRAPH_LOCALES[preview.locale] },
		{ property: 'og:locale:alternate', content: OPEN_GRAPH_LOCALES[otherLocale] },
		{ property: 'og:type', content: 'website' },
		{ property: 'og:url', content: preview.url },
		{ property: 'og:title', content: preview.title },
		{ property: 'og:description', content: preview.description },
		{ property: 'og:image', content: image.url },
		...imageDimensionTags,
		{ property: 'og:image:alt', content: preview.imageAlt },
		{ name: 'twitter:card', content: 'summary_large_image' },
		{ name: 'twitter:title', content: preview.title },
		{ name: 'twitter:description', content: preview.description },
		{ name: 'twitter:image', content: image.url },
		{ name: 'twitter:image:alt', content: preview.imageAlt },
	];
}

export function landingPageUrl(locale: string): string {
	return socialLocale(locale) === 'en' ? `${SITE_URL}/en` : SITE_URL;
}

export function buildLandingSocialMetaTags(locale: string): SocialMetaTag[] {
	const previewLocale = socialLocale(locale);
	const title = m.landing_og_title({}, { locale: previewLocale });
	return buildSocialMetaTags({
		title,
		description: m.landing_og_description({}, { locale: previewLocale }),
		url: landingPageUrl(locale),
		image: SOCIAL_PREVIEW_IMAGE,
		imageAlt: title,
		locale: previewLocale,
	});
}

/**
 * A wishlist previews as its title over „Seznam přání pro {recipient}", with the
 * `social` slot crop the owner framed in the crop editor (issue #117), else the
 * branded fallback image.
 */
export function buildWishlistSocialMetaTags(
	wishlist: WishlistSocialSource,
	locale: string,
): SocialMetaTag[] {
	const previewLocale = socialLocale(locale);
	const image = wishlistSocialImage(wishlist.imageKey, wishlist.imageSlots, SOCIAL_PREVIEW_IMAGE);
	const isFallbackImage = image === SOCIAL_PREVIEW_IMAGE;
	return buildSocialMetaTags({
		title: wishlist.title,
		description: wishlistSocialDescription(wishlist.recipientDisplayName, {
			locale: previewLocale,
		}),
		url: wishlistPageUrl(wishlist.shortId),
		image: { ...image, url: new URL(image.url, SITE_URL).href },
		imageAlt: isFallbackImage
			? m.landing_og_title({}, { locale: previewLocale })
			: wishlist.title,
		locale: previewLocale,
	});
}

export function wishlistPageUrl(shortId: string): string {
	return `${SITE_URL}/w/${shortId}`;
}
