import { describe, expect, it } from 'vitest';
import { createSentryClientOptions } from './sentry_client.js';
import { SENTRY_DATA_COLLECTION } from './sentry_privacy.js';

describe('createSentryClientOptions', () => {
	it('connects privacy filtering and conservative telemetry to browser initialization', () => {
		const replayIntegration = { name: 'Replay' };
		const options = createSentryClientOptions({
			dsn: 'https://public@example.ingest.sentry.io/1',
			environment: 'production',
			replayIntegration,
		});

		expect(options).toMatchObject({
			enabled: true,
			environment: 'production',
			sendDefaultPii: false,
			dataCollection: SENTRY_DATA_COLLECTION,
			tracesSampleRate: 0,
			enableLogs: false,
			replaysSessionSampleRate: 0.1,
			replaysOnErrorSampleRate: 1,
			integrations: [replayIntegration],
		});
		expect(options.beforeSend).toBeTypeOf('function');
		expect(options.beforeBreadcrumb).toBeTypeOf('function');
	});
});
