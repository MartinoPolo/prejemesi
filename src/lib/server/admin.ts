import { env } from '$env/dynamic/private';

/**
 * App-admin resolution (issue #150, decision 2026-07-14). A single operator is designated via the
 * comma-separated `ADMIN_EMAILS` env var. Being an app admin grants EXACTLY the reserved-list
 * revert-to-draft power plus the settings gear on active lists (danger actions only). An admin is
 * NOT a správce — this never grants management rights and never surfaces in list/header/panel UI.
 *
 * Server-side only: `ADMIN_EMAILS` is a private env var, never shipped to the client. The client
 * learns whether an action is available through the server-computed capability, not this helper.
 */

/** Parse a comma-separated admin-email list into normalized, lowercased, non-empty entries. */
export function parseAdminEmails(rawAdminEmails: string | null | undefined): string[] {
	return (rawAdminEmails ?? '')
		.split(',')
		.map((entry) => entry.trim().toLowerCase())
		.filter((entry) => entry !== '');
}

/**
 * Whether `email` appears in `rawAdminEmails` (comma-separated). Pure and case-insensitive — the
 * testable core of {@link isAppAdmin}, decoupled from the env read.
 */
export function emailMatchesAdminList(
	email: string | null | undefined,
	rawAdminEmails: string | null | undefined,
): boolean {
	if (email === null || email === undefined || email === '') {
		return false;
	}
	return parseAdminEmails(rawAdminEmails).includes(email.trim().toLowerCase());
}

/** Whether the given session email is an app admin (matches the `ADMIN_EMAILS` env var). */
export function isAppAdmin(email: string | null | undefined): boolean {
	return emailMatchesAdminList(email, env.ADMIN_EMAILS);
}
