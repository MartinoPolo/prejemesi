const CANONICAL_HOSTNAME = 'prejemesi.cz';
export const WWW_HOSTNAME = `www.${CANONICAL_HOSTNAME}`;
export const SITE_URL = `https://${CANONICAL_HOSTNAME}`;

export const SOCIAL_PREVIEW_IMAGE_URL = `${SITE_URL}/social-preview.png`;

export function getApplicationUrl(pathname: string, currentOrigin: string | undefined): string {
	const origin =
		import.meta.env.DEV && currentOrigin !== undefined && currentOrigin !== ''
			? currentOrigin
			: SITE_URL;

	return new URL(pathname, origin).toString();
}

export function getApplicationHost(currentHost: string | undefined): string {
	return import.meta.env.DEV && currentHost !== undefined && currentHost !== ''
		? currentHost
		: CANONICAL_HOSTNAME;
}
