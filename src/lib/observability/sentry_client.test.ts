import { describe, expect, it } from 'vitest';
import { createSentryClientOptions, filterAndSanitizeSentryClientEvent } from './sentry_client.js';
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
		expect(options.beforeSend).toBe(filterAndSanitizeSentryClientEvent);
		expect(options.beforeBreadcrumb).toBeTypeOf('function');
	});

	it('drops the Cloudflare Web Analytics compatibility error', () => {
		const event = {
			exception: {
				values: [
					{
						type: 'TypeError',
						value: 't.entries.at is not a function',
						stacktrace: {
							frames: [
								{
									abs_path:
										'https://static.cloudflareinsights.com/beacon.min.js/version',
								},
							],
						},
					},
				],
			},
		};

		expect(filterAndSanitizeSentryClientEvent(event)).toBeNull();
	});

	it('keeps matching messages when an application frame is present', () => {
		const event = {
			exception: {
				values: [
					{
						type: 'TypeError',
						value: 't.entries.at is not a function',
						stacktrace: {
							frames: [{ abs_path: 'https://prejemesi.cz/app.js' }],
						},
					},
				],
			},
		};

		expect(filterAndSanitizeSentryClientEvent(event)).toEqual(event);
	});

	it('keeps chained events containing an application exception', () => {
		const event = {
			exception: {
				values: [
					{
						type: 'TypeError',
						value: 't.entries.at is not a function',
						stacktrace: {
							frames: [
								{
									abs_path:
										'https://static.cloudflareinsights.com/beacon.min.js/version',
								},
							],
						},
					},
					{
						type: 'Error',
						value: 'Application failure',
						stacktrace: {
							frames: [{ abs_path: 'https://prejemesi.cz/app.js' }],
						},
					},
				],
			},
		};

		expect(filterAndSanitizeSentryClientEvent(event)).toEqual(event);
	});
});
