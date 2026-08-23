import { describe, expect, it } from 'vitest';
import {
	SENTRY_DATA_COLLECTION,
	sanitizeSentryBreadcrumb,
	sanitizeSentryEvent,
	sanitizeSentryReplayEvent,
} from './sentry_privacy.js';

describe('SENTRY_DATA_COLLECTION', () => {
	it('disables collection of request, identity, and application data', () => {
		expect(SENTRY_DATA_COLLECTION).toMatchObject({
			userInfo: false,
			cookies: false,
			httpHeaders: { request: false, response: false },
			httpBodies: [],
			urlQueryParams: false,
			databaseQueryData: false,
			stackFrameVariables: false,
		});
	});
});

describe('sanitizeSentryEvent', () => {
	it('removes user and sensitive request details', () => {
		const event = {
			user: { email: 'person@example.com' },
			request: {
				method: 'POST',
				url: 'https://prejemesi.cz/reset-password?token=secret',
				headers: { cookie: 'secret' },
				data: { password: 'secret' },
			},
		};

		expect(sanitizeSentryEvent(event)).toEqual({
			request: {
				method: 'POST',
				url: 'https://prejemesi.cz/reset-password',
			},
		});
	});

	it('drops arbitrary custom data while preserving safe replay correlation', () => {
		const event = {
			message: 'Failed for person@example.com',
			extra: {
				address: 'Family Street 1',
				recipient: 'Family Member',
			},
			tags: { listTitle: 'Private birthday list', replayId: 'safe-replay-id' },
			contexts: {
				family: { member: 'Family Member' },
				browser: { name: 'Firefox', version: '128' },
			},
		};

		expect(sanitizeSentryEvent(event)).toEqual({
			message: 'Failed for [redacted-email]',
			tags: { replayId: 'safe-replay-id' },
			contexts: {
				browser: { name: '[redacted]', version: '128' },
			},
		});
	});
});

describe('sanitizeSentryReplayEvent', () => {
	it('removes URL details and credentials from replay recording events', () => {
		const event = {
			data: {
				url: 'https://prejemesi.cz/reset-password?token=secret',
				headers: { authorization: 'Bearer secret' },
				message: 'Request failed for person@example.com with Bearer abc.def',
			},
		};

		expect(sanitizeSentryReplayEvent(event)).toEqual({
			data: {
				url: 'https://prejemesi.cz/reset-password',
				headers: { authorization: '[redacted]' },
				message: 'Request failed for [redacted-email] with Bearer [redacted]',
			},
		});
	});
});

describe('sanitizeSentryBreadcrumb', () => {
	it('removes query strings and sensitive breadcrumb data', () => {
		const breadcrumb = {
			data: {
				url: 'https://prejemesi.cz/api/auth/verify-email?token=secret',
				from: '/register?redirect=%2Fw%2Fabc',
				authorization: 'Bearer secret',
			},
		};

		expect(sanitizeSentryBreadcrumb(breadcrumb)).toEqual({
			data: {
				url: 'https://prejemesi.cz/api/auth/verify-email',
				from: '/register',
				authorization: '[redacted]',
			},
		});
	});
});
