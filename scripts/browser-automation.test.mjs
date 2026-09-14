import assert from 'node:assert/strict';
import test from 'node:test';
import {
	automatedServerEnvironment,
	resolveBrowserLaunchOptions,
	sharedChromeLaunchOptions,
} from './browser-automation.mjs';

test('defaults automation to installed Google Chrome with browser opening suppressed', () => {
	assert.deepEqual(resolveBrowserLaunchOptions({}), { channel: 'chrome' });
	assert.deepEqual(automatedServerEnvironment, { BROWSER: 'none', BROWSER_ARGS: '' });
	assert.ok(Object.isFrozen(sharedChromeLaunchOptions));
	assert.ok(Object.isFrozen(automatedServerEnvironment));
});

test('allows the bundled Chromium for isolated automation', () => {
	assert.deepEqual(resolveBrowserLaunchOptions({ AUTOMATION_BROWSER: 'chromium' }), {});
});

test('rejects unsupported automation browsers', () => {
	assert.throws(
		() => resolveBrowserLaunchOptions({ AUTOMATION_BROWSER: 'unsupported' }),
		/AUTOMATION_BROWSER/,
	);
});
