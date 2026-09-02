import { describe, expect, it } from 'vitest';
import {
	authenticatedIdlePreloadRoutes,
	shouldIdlePreloadAuthenticatedRoutes,
} from './idle_preload_eligibility.js';

describe('authenticated idle preload eligibility', () => {
	it.each([
		{ authenticated: false, connection: undefined, expected: false },
		{ authenticated: true, connection: undefined, expected: true },
		{ authenticated: true, connection: { saveData: true }, expected: false },
		{ authenticated: true, connection: { effectiveType: 'slow-2g' }, expected: false },
		{ authenticated: true, connection: { effectiveType: '2g' }, expected: false },
		{ authenticated: true, connection: { effectiveType: '3g' }, expected: true },
		{ authenticated: true, connection: { effectiveType: '4g' }, expected: true },
	])(
		'returns $expected when authenticated=$authenticated and connection=$connection',
		({ authenticated, connection, expected }) => {
			expect(shouldIdlePreloadAuthenticatedRoutes(authenticated, connection)).toBe(expected);
		},
	);
});

describe('authenticated idle preload route selection', () => {
	it('warms the dominant followed-list destination from the overview', () => {
		expect(authenticatedIdlePreloadRoutes('/home')).toEqual(['/followed']);
		expect(authenticatedIdlePreloadRoutes('/en/home')).toEqual(['/followed']);
	});

	it('warms the overview from other authenticated routes', () => {
		expect(authenticatedIdlePreloadRoutes('/w/example')).toEqual(['/home']);
		expect(authenticatedIdlePreloadRoutes('/settings')).toEqual(['/home']);
	});
});
