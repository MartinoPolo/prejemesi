import { describe, expect, it } from 'vitest';
import { SENTRY_DATA_COLLECTION } from './sentry_privacy.js';
import { createSentryServerOptions } from './sentry_server.js';

describe('createSentryServerOptions', () => {
	it('configures private Worker error capture without request bodies', () => {
		const options = createSentryServerOptions({
			dsn: 'https://public@example.ingest.sentry.io/1',
			environment: 'production',
			release: 'commit-sha',
		});
		const existingHttpIntegration = { name: 'HttpServer', maxRequestBodySize: 'medium' };
		const otherIntegration = { name: 'Other' };
		const integrations = options.integrations([existingHttpIntegration, otherIntegration]);

		expect(options).toMatchObject({
			enabled: true,
			environment: 'production',
			release: 'commit-sha',
			sendDefaultPii: false,
			dataCollection: SENTRY_DATA_COLLECTION,
			tracesSampleRate: 0,
			enableLogs: false,
		});
		expect(options.beforeSend).toBeTypeOf('function');
		expect(options.beforeBreadcrumb).toBeTypeOf('function');
		expect(integrations).not.toContain(existingHttpIntegration);
		expect(integrations).toContain(otherIntegration);
		expect(integrations).toContainEqual(
			expect.objectContaining({ name: 'HttpServer', maxRequestBodySize: 'none' }),
		);
	});
});
