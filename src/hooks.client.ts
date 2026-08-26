import { dev } from '$app/environment';
import { env } from '$env/dynamic/public';
import type { ClientInit, HandleClientError } from '@sveltejs/kit';

const dsn = env.PUBLIC_SENTRY_DSN?.trim();
const hasDsn = dsn !== undefined && dsn !== '';

// Sentry's browser SDK and Replay pull hundreds of modules into an unbundled dev page.
// Keep the optional integration out of the client graph when no DSN is configured.
interface SentryReplayIntegration {
	name: string;
}

interface SentryReplayControl {
	startBuffering(): void;
	stop(options: { flush: false }): Promise<void>;
}

interface SentryReplayApi {
	replayIntegration?: (options: Record<string, unknown>) => SentryReplayIntegration;
	getReplay?: () => SentryReplayControl | undefined;
}

const sentryErrorHandlerPromise = hasDsn
	? Promise.all([
			import('@sentry/sveltekit'),
			import('$lib/observability/sentry_client.js'),
			import('$lib/observability/sentry_privacy.js'),
			import('$lib/observability/sentry_replay_policy.js'),
		]).then(([Sentry, { createSentryClientOptions }, privacy, replayPolicy]) => {
			const sentryWithReplay = Sentry as SentryReplayApi;
			const replayIntegration = sentryWithReplay.replayIntegration?.({
				maskAllText: true,
				maskAllInputs: true,
				maskAttributes: [
					'aria-label',
					'alt',
					'href',
					'placeholder',
					'src',
					'title',
					'value',
				],
				block: ['input[type="hidden"]'],
				blockAllMedia: true,
				networkCaptureBodies: false,
				networkDetailDenyUrls: [/.*/],
				networkRequestHeaders: [],
				networkResponseHeaders: [],
				beforeAddRecordingEvent: privacy.sanitizeSentryReplayEvent,
			});

			Sentry.init(
				createSentryClientOptions({
					dsn,
					environment: dev ? 'development' : 'production',
					replayIntegration,
				}),
			);

			const replay = sentryWithReplay.getReplay?.();
			if (replay !== undefined) {
				const synchronizeReplay = replayPolicy.createSentryReplaySynchronizer(replay);
				window.addEventListener(replayPolicy.SENTRY_REPLAY_NAVIGATION_EVENT, (event) => {
					if (event instanceof CustomEvent && typeof event.detail === 'string') {
						synchronizeReplay(new URL(event.detail, window.location.href));
					}
				});
				synchronizeReplay(new URL(window.location.href));
			}

			return Sentry.handleErrorWithSentry() as HandleClientError;
		})
	: undefined;

export const init: ClientInit = async () => {
	await sentryErrorHandlerPromise;
};

export const handleError: HandleClientError = async (input) => {
	const sentryErrorHandler = await sentryErrorHandlerPromise;
	if (sentryErrorHandler !== undefined) {
		return sentryErrorHandler(input);
	}
	console.error(input.error);
};
