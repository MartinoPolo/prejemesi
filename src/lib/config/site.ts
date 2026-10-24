const CANONICAL_HOSTNAME = 'prejemesi.cz';
export const WWW_HOSTNAME = `www.${CANONICAL_HOSTNAME}`;
const STAGING_HOSTNAME = `staging.${CANONICAL_HOSTNAME}`;
export const SITE_URL = `https://${CANONICAL_HOSTNAME}`;

export function isStagingHostname(hostname: string): boolean {
	return hostname === STAGING_HOSTNAME;
}

export type DeploymentEnvironment = 'development' | 'staging' | 'production';

export function deploymentEnvironment(hostname: string): DeploymentEnvironment {
	if (import.meta.env.DEV) {
		return 'development';
	}
	return isStagingHostname(hostname) ? 'staging' : 'production';
}

// Links copied on staging must stay on staging; any other host falls back to the canonical site.
function trustsCurrentHost(host: string | undefined): host is string {
	if (host === undefined || host === '') {
		return false;
	}
	return import.meta.env.DEV || isStagingHostname(host);
}

export function getApplicationUrl(pathname: string, currentOrigin: string | undefined): string {
	const currentHost =
		currentOrigin !== undefined && URL.canParse(currentOrigin)
			? new URL(currentOrigin).host
			: undefined;
	const origin = trustsCurrentHost(currentHost) ? currentOrigin : SITE_URL;

	return new URL(pathname, origin).toString();
}

export function getApplicationHost(currentHost: string | undefined): string {
	return trustsCurrentHost(currentHost) ? currentHost : CANONICAL_HOSTNAME;
}
