export const ROBOTS_NOINDEX_CONTENT = 'noindex, nofollow, noarchive';

const AUTH_PAGE_PATHS = new Set(['/login', '/register', '/magic-link', '/reset-password']);
const PRIVATE_PAGE_PATHS = new Set(['/my-lists', '/moderated', '/followed', '/settings']);

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
