/** Whether the browser offers the system share sheet (`navigator.share`), mostly phones. */
export function isNativeShareAvailable(): boolean {
	return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

/**
 * Opens the system share sheet. Resolves `false` when the user dismisses it, which browsers
 * report as an `AbortError` and is not a failure; other errors propagate.
 */
export async function shareNatively(data: ShareData): Promise<boolean> {
	try {
		await navigator.share(data);
		return true;
	} catch (thrown) {
		if (thrown instanceof DOMException && thrown.name === 'AbortError') {
			return false;
		}
		throw thrown;
	}
}
