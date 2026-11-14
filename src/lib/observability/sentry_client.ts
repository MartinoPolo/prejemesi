import type { DeploymentEnvironment } from '$lib/config/site.js';
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
const MODULE_LOAD_FAILURE_PATTERN =
	/^(Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed)(: .+|\.)?$/;

export function filterAndSanitizeSentryClientEvent<T>(event: T): T | null {
	const clientEvent = event as ClientSentryEvent;
	const exceptions = clientEvent.exception?.values ?? [];
	const isBrowserLoadFailure =
		exceptions.length > 0 &&
		exceptions.every((exception) => {
			const message = exception.value ?? '';
			return (
				exception.type === 'TypeError' &&
				(BROWSER_NETWORK_FAILURE_PATTERN.test(message) ||
					MODULE_LOAD_FAILURE_PATTERN.test(message))
			);
		});
	if (isBrowserLoadFailure) {
		// A request or module load that never completed is a connectivity or deployment outcome
		// the user already sees handled, not an application defect; warning level keeps sustained
		// outages visible without triggering error alerts.
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
	environment: DeploymentEnvironment;
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
