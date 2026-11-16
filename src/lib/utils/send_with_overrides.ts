import type { RemoteQueryOverride } from '@sveltejs/kit';

interface CommandWithUpdates<Result> extends Promise<Result> {
	updates(...updates: RemoteQueryOverride[]): Promise<Result>;
}

/**
 * Sends a remote command carrying optimistic query overrides that were applied earlier, at click
 * time. The command releases them right after the response's refreshed data lands, or with nothing
 * applied when it fails, which restores the exact prior state. Only a command that never starts
 * leaves the releasing to this function, so each override is released exactly once.
 */
export function sendWithOverrides<Result>(
	overrides: readonly RemoteQueryOverride[],
	sendCommand: () => CommandWithUpdates<Result>,
): Promise<Result> {
	try {
		return sendCommand().updates(...overrides);
	} catch (thrown) {
		for (const release of overrides) {
			release();
		}
		return Promise.reject(thrown);
	}
}
