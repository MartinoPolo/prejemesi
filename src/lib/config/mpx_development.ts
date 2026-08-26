type Environment = Readonly<Record<string, string | undefined>>;

function port(environment: Environment, name: string, fallback: number): number {
	const value = Number(environment[name]);
	return Number.isInteger(value) && value > 0 && value <= 65_535 ? value : fallback;
}

function localhost(portNumber: number): string {
	return `http://localhost:${portNumber}`;
}

function configured(value: string | undefined): value is string {
	return value !== undefined && value !== '';
}

export function resolveDevelopmentEnvironment(environment: Environment = process.env) {
	const appPort = port(environment, 'MPX_APP_PORT', 8300);
	const previewPort = port(environment, 'MPX_PREVIEW_PORT', 8301);
	const appOrigin = localhost(appPort);
	const previewOrigin = localhost(previewPort);

	return {
		appPort,
		previewPort,
		storybookPort: port(environment, 'MPX_STORYBOOK_PORT', 8302),
		vitestClientPort: port(environment, 'MPX_VITEST_CLIENT_PORT', 8303),
		vitestStorybookPort: port(environment, 'MPX_VITEST_STORYBOOK_PORT', 8304),
		databasePort: port(environment, 'MPX_DATABASE_PORT', 5432),
		appOrigin,
		previewOrigin,
		origin: configured(environment.MPX_APP_PORT)
			? appOrigin
			: configured(environment.ORIGIN)
				? environment.ORIGIN
				: appOrigin,
		playwrightBaseUrl: configured(environment.PLAYWRIGHT_BASE_URL)
			? environment.PLAYWRIGHT_BASE_URL
			: appOrigin,
		loadTestLocalTarget: configured(environment.LOADTEST_LOCAL_URL)
			? environment.LOADTEST_LOCAL_URL
			: appOrigin,
		r2LocalOrigins: [appOrigin, previewOrigin],
	};
}

export function resolveDatabaseUrl(environment: Environment): string | undefined {
	if (configured(environment.DATABASE_URL)) {
		return environment.DATABASE_URL;
	}
	if (!configured(environment.MPX_DATABASE_PORT)) {
		return undefined;
	}
	const databasePort = port(environment, 'MPX_DATABASE_PORT', 5432);
	return `postgres://root:mysecretpassword@localhost:${databasePort}/local`;
}

export function resolveAuthOrigins(environment: Environment, development: boolean) {
	const baseURL = resolveDevelopmentEnvironment(environment).origin;
	const configured = (environment.BETTER_AUTH_TRUSTED_ORIGINS ?? '')
		.split(',')
		.map((origin) => origin.trim())
		.filter(Boolean);
	return {
		baseURL,
		trustedOrigins: [...new Set([...(development ? [baseURL] : []), ...configured])],
	};
}
