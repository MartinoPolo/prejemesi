import { page } from '$app/state';

export function isNavActive(href: string): boolean {
	return page.url.pathname.startsWith(href);
}
