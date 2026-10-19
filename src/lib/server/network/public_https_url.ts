/** Names that never resolve to a public server; `.localhost` covers `localhost` itself. */
const LOCAL_HOSTNAME_SUFFIXES = ['.localhost', '.local', '.internal', '.lan', '.home.arpa'];

/**
 * An HTTPS URL on the default port, without credentials, whose host is a public DNS name. IP
 * literals are refused outright, so no private, loopback or metadata address can be named
 * directly. Workers' `fetch` resolves names itself, so a name's DNS answer is not checkable here.
 */
export function isPublicHttpsUrl(url: URL): boolean {
	if (url.protocol !== 'https:' || url.username !== '' || url.password !== '') {
		return false;
	}
	const hostname = url.hostname.toLowerCase().replace(/\.+$/, '');
	const isIpLiteral = hostname.startsWith('[') || /^[\d.]+$/.test(hostname);
	const isLocalName =
		!hostname.includes('.') ||
		LOCAL_HOSTNAME_SUFFIXES.some((suffix) => `.${hostname}`.endsWith(suffix));
	return url.port === '' && !isIpLiteral && !isLocalName;
}
