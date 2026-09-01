type Environment = Readonly<Record<string, string | undefined>>;

function port(environment: Environment, name: string, fallback: number): number {
	const raw = environment[name];
	let value = Number(raw);
	if (raw !== undefined && raw !== '' && !Number.isInteger(value)) {
		try {
			value = Number(new URL(raw).port);
		} catch {
			return fallback;
		}
	}
	return Number.isInteger(value) && value > 0 && value <= 65_535 ? value : fallback;
}

function loopbackOrigin(host: string, portNumber: number): string {
	return `http://${host}:${portNumber}`;
}

function servicePort(
	environment: Environment,
	urlName: string,
	legacyPortName: string,
	fallback: number,
): number {
	const assignedUrl = environment[urlName];
	if (assignedUrl !== undefined && assignedUrl !== '') {
		try {
			const parsed = new URL(assignedUrl);
			const assignedPort = Number(parsed.port);
			if (Number.isInteger(assignedPort) && assignedPort > 0 && assignedPort <= 65_535) {
				return assignedPort;
			}
		} catch {
			// Invalid assignments fall through to the legacy port or preferred port.
		}
	}
	return port(environment, legacyPortName, fallback);
}

function configured(value: string | undefined): value is string {
	return value !== undefined && value !== '';
}

export function resolveDevelopmentEnvironment(environment: Environment = process.env) {
	const appHost = 'localhost';
	const appPort = servicePort(environment, 'MPX_APP_URL', 'MPX_APP_PORT', 8300);
	const previewPort = servicePort(environment, 'MPX_PREVIEW_URL', 'MPX_PREVIEW_PORT', 8301);
	const appOrigin = loopbackOrigin(appHost, appPort);
	const previewOrigin = loopbackOrigin(appHost, previewPort);
	const appServer = { host: appHost, port: appPort };

	return {
		appPort,
		appServer,
		previewPort,
		storybookPort: servicePort(environment, 'MPX_STORYBOOK_URL', 'MPX_STORYBOOK_PORT', 8302),
		vitestClientPort: servicePort(
			environment,
			'MPX_VITEST_CLIENT_URL',
			'MPX_VITEST_CLIENT_PORT',
			8303,
		),
		vitestStorybookPort: servicePort(
			environment,
			'MPX_VITEST_STORYBOOK_URL',
			'MPX_VITEST_STORYBOOK_PORT',
			8304,
		),
		databasePort: port(environment, 'MPX_DATABASE_PORT', 5432),
		appOrigin,
		previewOrigin,
		origin:
			configured(environment.MPX_APP_URL) || configured(environment.MPX_APP_PORT)
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
	if (!configured(environment.MPX_DATABASE_URL) && !configured(environment.MPX_DATABASE_PORT)) {
		return undefined;
	}
	const databasePort = servicePort(environment, 'MPX_DATABASE_URL', 'MPX_DATABASE_PORT', 5432);
	return `postgres://root:mysecretpassword@localhost:${databasePort}/local`;
}

export function resolveAuthOrigins(environment: Environment, development: boolean) {
	const resolved = resolveDevelopmentEnvironment(environment);
	const baseURL = development ? resolved.appOrigin : resolved.origin;
	const configured = (environment.BETTER_AUTH_TRUSTED_ORIGINS ?? '')
		.split(',')
		.map((origin) => origin.trim())
		.filter(Boolean);
	return {
		baseURL,
		trustedOrigins: [...new Set([...(development ? [baseURL] : []), ...configured])],
	};
}
