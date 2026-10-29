import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/environment', () => ({ dev: false, building: false, browser: false }));

import { contentSecurityPolicy } from './content_security_policy.js';

function directives(policy: string): string[] {
	return policy.split('; ');
}

describe('contentSecurityPolicy', () => {
	it('keeps the site policy with form submissions limited to the site', () => {
		expect(directives(contentSecurityPolicy())).toEqual([
			"base-uri 'self'",
			"object-src 'none'",
			"frame-ancestors 'none'",
			"form-action 'self'",
			'upgrade-insecure-requests',
		]);
	});

	it('appends the given form-action sources after the site', () => {
		const policy = contentSecurityPolicy(['https://claude.ai', 'com.example.app:']);

		expect(directives(policy)).toContain(
			"form-action 'self' https://claude.ai com.example.app:",
		);
		expect(directives(policy)).toContain("frame-ancestors 'none'");
	});
});
