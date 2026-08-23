import { httpServerIntegration } from '@sentry/cloudflare';
import {
	SENTRY_DATA_COLLECTION,
	sanitizeSentryBreadcrumb,
	sanitizeSentryEvent,
} from './sentry_privacy.js';

function configureSentryServerIntegrations<T extends { name: string }>(defaultIntegrations: T[]) {
	return [
		...defaultIntegrations.filter(({ name }) => name !== 'HttpServer'),
		httpServerIntegration({ maxRequestBodySize: 'none' }),
	];
}

export function createSentryServerOptions({
	dsn,
	environment,
	release,
}: {
	dsn?: string;
	environment: 'development' | 'production';
	release?: string;
}) {
	return {
		dsn,
		enabled: dsn !== undefined && dsn !== '',
		environment,
		release,
		sendDefaultPii: false,
		dataCollection: SENTRY_DATA_COLLECTION,
		integrations: configureSentryServerIntegrations,
		tracesSampleRate: 0,
		enableLogs: false,
		beforeSend: sanitizeSentryEvent,
		beforeBreadcrumb: sanitizeSentryBreadcrumb,
	};
}
