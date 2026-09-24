export interface NetworkConnectionInfo {
	saveData?: boolean;
	effectiveType?: string;
}

export function shouldIdlePreloadAuthenticatedRoutes(
	authenticated: boolean,
	connection?: NetworkConnectionInfo,
): boolean {
	if (!authenticated || connection?.saveData === true) {
		return false;
	}

	return connection?.effectiveType !== 'slow-2g' && connection?.effectiveType !== '2g';
}

export function authenticatedIdlePreloadRoutes(pathname: string): string[] {
	return /(?:^|\/)home\/?$/.test(pathname) ? ['/followed'] : ['/home'];
}
