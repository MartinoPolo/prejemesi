import {
	PARALLEL_APPLICATION_ORIGINS,
	PREFERRED_APPLICATION_ORIGIN,
	PREVIEW_ORIGIN,
} from '../../../scripts/local-development-ports.mjs';

type Environment = Readonly<Record<string, string | undefined>>;

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);
const DEVELOPMENT_AUTH_HOSTS = ['localhost:*', '127.0.0.1:*', '[::1]:*'] as const;

function configured(value: string | undefined): value is string {
	return value !== undefined && value !== '';
}

function strictPort(environment: Environment, name: string, fallback: number): number {
	const raw = environment[name];
	if (!configured(raw)) {
		return fallback;
	}
	const value = Number(raw);
	if (!Number.isInteger(value) || value <= 0 || value > 65_535) {
		throw new Error(`${name} must be an integer from 1 through 65535.`);
	}
	return value;
}

function explicitTrustedOrigins(environment: Environment): string[] {
	return (environment.BETTER_AUTH_TRUSTED_ORIGINS ?? '')
		.split(',')
		.map((origin) => origin.trim())
		.filter(Boolean);
}

export function resolveRuntimeEnvironment(environment: Environment = process.env) {
	const vitestClientPort = strictPort(environment, 'VITEST_CLIENT_PORT', 8310);
	const vitestStorybookPort = strictPort(environment, 'VITEST_STORYBOOK_PORT', 8311);
	if (vitestClientPort === vitestStorybookPort) {
		throw new Error('VITEST_CLIENT_PORT and VITEST_STORYBOOK_PORT must be distinct.');
	}

	return {
		previewOrigin: PREVIEW_ORIGIN,
		loadTestLocalTarget: configured(environment.LOADTEST_LOCAL_URL)
			? environment.LOADTEST_LOCAL_URL
			: PREFERRED_APPLICATION_ORIGIN,
		vitestClientPort,
		vitestStorybookPort,
		r2LocalOrigins: [...PARALLEL_APPLICATION_ORIGINS, PREVIEW_ORIGIN],
	};
}

export function resolveDatabaseUrl(environment: Environment): string | undefined {
	if (configured(environment.DATABASE_URL)) {
		return environment.DATABASE_URL;
	}
	const compatibilityValue = environment.MPX_DATABASE_URL ?? environment.MPX_DATABASE_PORT;
	if (!configured(compatibilityValue)) {
		return undefined;
	}

	let port = Number(compatibilityValue);
	if (!Number.isInteger(port)) {
		try {
			port = Number(new URL(compatibilityValue).port);
		} catch {
			return undefined;
		}
	}
	return Number.isInteger(port) && port > 0 && port <= 65_535
		? `postgres://root:mysecretpassword@localhost:${port}/local`
		: undefined;
}

export function resolveAuthOrigins(environment: Environment, development: boolean) {
	const trustedOrigins = explicitTrustedOrigins(environment);
	if (!development) {
		return {
			baseURL: configured(environment.ORIGIN)
				? environment.ORIGIN
				: PREFERRED_APPLICATION_ORIGIN,
			trustedOrigins,
			trustedProxyHeaders: false,
		};
	}
	return {
		baseURL: {
			allowedHosts: [...DEVELOPMENT_AUTH_HOSTS],
			protocol: 'http' as const,
		},
		trustedOrigins,
		trustedProxyHeaders: false,
	};
}

export function resolveApplicationOrigin(
	environment: Environment,
	development: boolean,
	requestUrl?: string,
): string {
	const fallback = configured(environment.ORIGIN)
		? environment.ORIGIN
		: PREFERRED_APPLICATION_ORIGIN;
	if (!development || requestUrl === undefined) {
		return fallback.replace(/\/$/, '');
	}
	try {
		const url = new URL(requestUrl);
		if (url.protocol === 'http:' && LOOPBACK_HOSTNAMES.has(url.hostname)) {
			return url.origin;
		}
	} catch {
		// Invalid request URLs use the configured fallback.
	}
	return fallback.replace(/\/$/, '');
}
