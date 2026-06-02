export function normalizeGiftUrl(url: string | null | undefined): string | null {
	if (url === null || url === undefined) {
		return null;
	}

	const trimmedUrl = url.trim();
	if (trimmedUrl === '') {
		return null;
	}

	try {
		const parsedUrl = new URL(trimmedUrl);
		if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
			return null;
		}
		return parsedUrl.toString();
	} catch {
		return null;
	}
}

export function extractGiftUrlDomain(url: string | null): string | null {
	const normalizedUrl = normalizeGiftUrl(url);
	if (normalizedUrl === null) {
		return null;
	}

	return new URL(normalizedUrl).hostname.replace(/^www\./, '');
}
