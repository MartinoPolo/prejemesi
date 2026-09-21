import assert from 'node:assert/strict';
import test from 'node:test';
import {
	automatedServerEnvironment,
	sharedBrowserTestLaunchOptions,
	sharedChromeLaunchOptions,
} from './browser-automation.mjs';

test('uses bundled Chromium for tests and installed Chrome for other automation', () => {
	assert.deepEqual(sharedBrowserTestLaunchOptions, { channel: 'chromium' });
	assert.deepEqual(sharedChromeLaunchOptions, { channel: 'chrome' });
	assert.deepEqual(automatedServerEnvironment, { BROWSER: 'none', BROWSER_ARGS: '' });
	assert.ok(Object.isFrozen(sharedBrowserTestLaunchOptions));
	assert.ok(Object.isFrozen(sharedChromeLaunchOptions));
	assert.ok(Object.isFrozen(automatedServerEnvironment));
});
