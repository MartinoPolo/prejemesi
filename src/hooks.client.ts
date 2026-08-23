import { dev } from '$app/environment';
import { env } from '$env/dynamic/public';
import * as Sentry from '@sentry/sveltekit';
import { createSentryClientOptions } from '$lib/observability/sentry_client.js';
import { sanitizeSentryReplayEvent } from '$lib/observability/sentry_privacy.js';
import {
	SENTRY_REPLAY_NAVIGATION_EVENT,
	createSentryReplaySynchronizer,
} from '$lib/observability/sentry_replay_policy.js';

const dsn = env.PUBLIC_SENTRY_DSN?.trim();

const replayIntegration = Sentry.replayIntegration({
	maskAllText: true,
	maskAllInputs: true,
	maskAttributes: ['aria-label', 'alt', 'href', 'placeholder', 'src', 'title', 'value'],
	block: ['input[type="hidden"]'],
	blockAllMedia: true,
	networkCaptureBodies: false,
	networkDetailDenyUrls: [/.*/],
	networkRequestHeaders: [],
	networkResponseHeaders: [],
	beforeAddRecordingEvent: sanitizeSentryReplayEvent,
});

Sentry.init(
	createSentryClientOptions({
		dsn,
		environment: dev ? 'development' : 'production',
		replayIntegration,
	}),
);

const replay = Sentry.getReplay();
if (replay !== undefined) {
	const synchronizeReplay = createSentryReplaySynchronizer(replay);
	window.addEventListener(SENTRY_REPLAY_NAVIGATION_EVENT, (event) => {
		if (event instanceof CustomEvent && typeof event.detail === 'string') {
			synchronizeReplay(new URL(event.detail, window.location.href));
		}
	});
	synchronizeReplay(new URL(window.location.href));
}

export const handleError = Sentry.handleErrorWithSentry();
