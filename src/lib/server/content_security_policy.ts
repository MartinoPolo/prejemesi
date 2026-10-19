import { dev } from '$app/environment';

export const CONTENT_SECURITY_POLICY_HEADER = 'Content-Security-Policy';

/**
 * The site's policy. Browsers apply `form-action` to the redirects that follow a form submission
 * too, so a page whose form ends at another origin, such as OAuth consent returning to the app,
 * names that origin.
 */
export function contentSecurityPolicy(formActionOrigins: readonly string[] = []): string {
	return [
		"base-uri 'self'",
		"object-src 'none'",
		"frame-ancestors 'none'",
		["form-action 'self'", ...formActionOrigins].join(' '),
		...(dev ? [] : ['upgrade-insecure-requests']),
	].join('; ');
}
