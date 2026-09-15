/** @param {Readonly<Record<string, string | undefined>>} environment */
export function resolveBrowserLaunchOptions(environment) {
	const browser = environment.AUTOMATION_BROWSER ?? 'chrome';
	if (browser === 'chromium') {
		return Object.freeze({});
	}
	if (browser !== 'chrome') {
		throw new Error('AUTOMATION_BROWSER must be chrome or chromium.');
	}
	return Object.freeze({ channel: 'chrome' });
}

export const sharedChromeLaunchOptions = resolveBrowserLaunchOptions(process.env);

export const automatedServerEnvironment = Object.freeze({
	BROWSER: 'none',
	BROWSER_ARGS: '',
});
