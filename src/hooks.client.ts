import { dev } from '$app/environment';
import { env } from '$env/dynamic/public';
import type { ClientInit, HandleClientError } from '@sveltejs/kit';
import type { getReplay, replayIntegration } from '@sentry/replay';
import {
	createSingletonSafeLoader,
	installEarlyErrorBuffer,
	scheduleAfterLoadAndIdle,
} from '$lib/observability/sentry_lazy.js';

const dsn = env.PUBLIC_SENTRY_DSN?.trim();
const hasDsn = dsn !== undefined && dsn !== '';
const earlyErrors = hasDsn ? installEarlyErrorBuffer(window) : undefined;

const loadSentry = createSingletonSafeLoader<HandleClientError>(
	async () => {
		const [Sentry, { createSentryClientOptions }, privacy, replayPolicy] = await Promise.all([
			import('$lib/observability/sentry_core_client.js'),
			import('$lib/observability/sentry_client.js'),
			import('$lib/observability/sentry_privacy.js'),
			import('$lib/observability/sentry_replay_policy.js'),
		]);

		Sentry.init(
			createSentryClientOptions({
				dsn,
				environment: dev ? 'development' : 'production',
			}),
		);
		earlyErrors?.flush((error) => Sentry.captureException(error));

		const client = Sentry.getClient();
		if (client !== undefined) {
			let replayApi:
				| {
						replayIntegration: typeof replayIntegration;
						getReplay: typeof getReplay;
				  }
				| undefined;
			let replayLoaded = false;
			const synchronizeReplay = replayPolicy.createLazySentryReplaySynchronizer({
				client,
				loadIntegration: async () => {
					replayApi = await import('@sentry/replay');
					replayLoaded = true;
					return replayApi.replayIntegration({
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
				},
				getReplay: () => replayApi?.getReplay(),
				onFailure: (error) => Sentry.captureException(error),
			});
			const synchronizeReplayForUrl = (url: URL) => {
				if (replayLoaded || replayPolicy.shouldDisableSentryReplay(url)) {
					void synchronizeReplay(url);
					return;
				}
				scheduleAfterLoadAndIdle(window, () => {
					void synchronizeReplay(new URL(window.location.href));
				});
			};
			window.addEventListener(replayPolicy.SENTRY_REPLAY_NAVIGATION_EVENT, (event) => {
				if (event instanceof CustomEvent && typeof event.detail === 'string') {
					synchronizeReplayForUrl(new URL(event.detail, window.location.href));
				}
			});
			synchronizeReplayForUrl(new URL(window.location.href));
		}

		return Sentry.handleErrorWithSentry() as HandleClientError;
	},
	(error) => {
		earlyErrors?.discard();
		console.error('[Sentry] client failed to load', error);
	},
);

export const init: ClientInit = () => {
	if (hasDsn) {
		scheduleAfterLoadAndIdle(window, () => {
			void loadSentry();
		});
	}
};

export const handleError: HandleClientError = async (input) => {
	if (hasDsn) {
		const sentryErrorHandler = await loadSentry();
		if (sentryErrorHandler !== undefined) {
			return sentryErrorHandler(input);
		}
	}
	console.error(input.error);
};
