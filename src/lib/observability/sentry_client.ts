import {
	SENTRY_DATA_COLLECTION,
	sanitizeSentryBreadcrumb,
	sanitizeSentryEvent,
} from './sentry_privacy.js';

interface ClientSentryEvent {
	level?: string;
	exception?: {
		values?: Array<{
			type?: string;
			value?: string;
			stacktrace?: { frames?: Array<{ abs_path?: string }> };
		}>;
	};
}

const CLOUDFLARE_BEACON_URL = 'https://static.cloudflareinsights.com/beacon.min.js/';
const BROWSER_NETWORK_FAILURE_PATTERN =
	/^(Load failed|Failed to fetch|NetworkError when attempting to fetch resource\.?)( \(.+\))?$/;

export function filterAndSanitizeSentryClientEvent<T>(event: T): T | null {
	const clientEvent = event as ClientSentryEvent;
	const exceptions = clientEvent.exception?.values ?? [];
	const isBrowserNetworkFailure =
		exceptions.length > 0 &&
		exceptions.every(
			(exception) =>
				exception.type === 'TypeError' &&
				BROWSER_NETWORK_FAILURE_PATTERN.test(exception.value ?? ''),
		);
	if (isBrowserNetworkFailure) {
		// A request that never completed is a connectivity outcome, not an application defect;
		// warning level keeps sustained outages visible without triggering error alerts.
		clientEvent.level = 'warning';
	}

	const isCloudflareBeaconCompatibilityError =
		exceptions.length > 0 &&
		exceptions.every((exception) => {
			const frames = exception.stacktrace?.frames ?? [];
			return (
				exception.type === 'TypeError' &&
				exception.value === 't.entries.at is not a function' &&
				frames.length > 0 &&
				frames.every((frame) => frame.abs_path?.startsWith(CLOUDFLARE_BEACON_URL) === true)
			);
		});

	return isCloudflareBeaconCompatibilityError ? null : sanitizeSentryEvent(event);
}

export function createSentryClientOptions<T extends { name: string }>({
	dsn,
	environment,
	replayIntegration,
}: {
	dsn?: string;
	environment: 'development' | 'production';
	replayIntegration?: T;
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
		integrations: replayIntegration === undefined ? [] : [replayIntegration],
		beforeSend: filterAndSanitizeSentryClientEvent,
		beforeBreadcrumb: sanitizeSentryBreadcrumb,
	};
}
