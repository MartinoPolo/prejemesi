import {
	SENTRY_DATA_COLLECTION,
	sanitizeSentryBreadcrumb,
	sanitizeSentryEvent,
} from './sentry_privacy.js';

export function createSentryClientOptions<T extends { name: string }>({
	dsn,
	environment,
	replayIntegration,
}: {
	dsn?: string;
	environment: 'development' | 'production';
	replayIntegration: T;
}) {
	return {
		dsn,
		enabled: dsn !== undefined && dsn !== '',
		environment,
		sendDefaultPii: false,
		dataCollection: SENTRY_DATA_COLLECTION,
		tracesSampleRate: 0,
		enableLogs: false,
		replaysSessionSampleRate: 0.1,
		replaysOnErrorSampleRate: 1,
		integrations: [replayIntegration],
		beforeSend: sanitizeSentryEvent,
		beforeBreadcrumb: sanitizeSentryBreadcrumb,
	};
}
