export const SENTRY_REPLAY_NAVIGATION_EVENT = 'sentry-replay-navigation';

interface SentryReplayControl {
	startBuffering(): void;
	stop(options: { flush: false }): Promise<void>;
}

const SENSITIVE_PATH_PATTERNS = [
	/^\/(?:en\/)?(?:login|magic-link|register|reset-password)(?:\/|$)/,
	/^\/(?:en\/)?unsubscribe(?:\/|$)/,
	/^\/(?:en\/)?w\/[^/]+\/(?:claim|invite)\/[^/]+(?:\/|$)/,
];

export function shouldDisableSentryReplay(url: URL): boolean {
	return (
		url.search !== '' || SENSITIVE_PATH_PATTERNS.some((pattern) => pattern.test(url.pathname))
	);
}

export function createSentryReplaySynchronizer(replay: SentryReplayControl) {
	let stoppedForSensitiveRoute = false;

	return (url: URL): void => {
		if (shouldDisableSentryReplay(url)) {
			stoppedForSensitiveRoute = true;
			void replay.stop({ flush: false });
			return;
		}
		if (stoppedForSensitiveRoute) {
			replay.startBuffering();
			stoppedForSensitiveRoute = false;
		}
	};
}
