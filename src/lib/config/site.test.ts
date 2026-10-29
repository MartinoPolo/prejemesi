import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deploymentEnvironment, getApplicationHost, getApplicationUrl } from './site.js';

describe('deployed site URLs', () => {
	beforeEach(() => {
		vi.stubEnv('DEV', false);
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it('keeps copied links on staging', () => {
		expect(getApplicationUrl('/w/abc', 'https://staging.prejemesi.cz')).toBe(
			'https://staging.prejemesi.cz/w/abc',
		);
		expect(getApplicationHost('staging.prejemesi.cz')).toBe('staging.prejemesi.cz');
	});

	it('uses the canonical site for any other host', () => {
		expect(getApplicationUrl('/w/abc', 'https://evil.example')).toBe(
			'https://prejemesi.cz/w/abc',
		);
		expect(getApplicationUrl('/w/abc', 'https://www.prejemesi.cz')).toBe(
			'https://prejemesi.cz/w/abc',
		);
		expect(getApplicationHost('evil.example')).toBe('prejemesi.cz');
		expect(getApplicationHost(undefined)).toBe('prejemesi.cz');
	});

	it('reports the deployment environment by hostname', () => {
		expect(deploymentEnvironment('staging.prejemesi.cz')).toBe('staging');
		expect(deploymentEnvironment('prejemesi.cz')).toBe('production');
	});
});
