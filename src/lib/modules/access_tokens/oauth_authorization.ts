/** Whether the page holds the signed query an app's authorization sends to sign-in and consent. */
export function isOauthAuthorizationQuery(searchParams: URLSearchParams): boolean {
	return searchParams.has('sig');
}
