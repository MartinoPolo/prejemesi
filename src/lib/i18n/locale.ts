import {
	deLocalizeHref,
	getLocaleForUrl,
	localizeHref,
	toLocale,
	type Locale,
} from '$lib/paraglide/runtime.js';

const DEFAULT_LOCALE: Locale = 'cs';
export const SUPPORTED_LOCALES = ['cs', 'en'] as const satisfies readonly Locale[];
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export function getActiveLocaleForUrl(url: URL | string): Locale {
	const parsedUrl = typeof url === 'string' ? new URL(url, 'http://localhost') : url;
	const firstPathSegment = parsedUrl.pathname.split('/').find(Boolean);

	return toLocale(firstPathSegment) ?? getLocaleForUrl(parsedUrl.href);
}

export function localizeInternalHref(href: string, locale?: Locale): string {
	return localizeHref(href, locale === undefined ? undefined : { locale });
}

export function localizeCurrentHref(url: URL, locale: Locale): string {
	const currentHref = `${url.pathname}${url.search}${url.hash}`;
	return localizeHref(deLocalizeHref(currentHref), { locale });
}

export function getLocalizedAuthCallback(
	redirectParameter: string | null,
	fallbackHref: string,
	locale?: Locale,
): string {
	if (redirectParameter !== null && redirectParameter !== '') {
		return redirectParameter;
	}

	return localizeInternalHref(fallbackHref, locale);
}

export function resolveLocalePreference(
	explicitLocale: unknown,
	preferredLocale: unknown,
	cookieLocale: unknown,
): Locale {
	return (
		toLocale(explicitLocale) ??
		toLocale(preferredLocale) ??
		toLocale(cookieLocale) ??
		DEFAULT_LOCALE
	);
}
