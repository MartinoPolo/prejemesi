export const ROBOTS_NOINDEX_CONTENT = 'noindex, nofollow, noarchive';

// '/unsubscribe' is public-but-token-scoped (issue #206) - not an auth page, but
// equally uninteresting to search engines.
const AUTH_PAGE_PATHS = new Set([
	'/login',
	'/register',
	'/magic-link',
	'/reset-password',
	'/unsubscribe',
]);
const PRIVATE_PAGE_PATHS = new Set(['/home', '/my-lists', '/moderated', '/followed', '/settings']);

function localizedPathname(pathname: string): string {
	const withoutLocale = pathname.replace(/^\/en(?=\/|$)/, '');
	return withoutLocale === '' ? '/' : withoutLocale;
}

function isPrivateWishlistChildPath(pathname: string): boolean {
	return /^\/w\/[^/]+\/.+/.test(pathname);
}

export function shouldNoindexPath(pathname: string): boolean {
	const path = localizedPathname(pathname);

	return (
		AUTH_PAGE_PATHS.has(path) ||
		PRIVATE_PAGE_PATHS.has(path) ||
		path === '/learn' ||
		path === '/api/auth' ||
		path.startsWith('/api/auth/') ||
		isPrivateWishlistChildPath(path)
	);
}
