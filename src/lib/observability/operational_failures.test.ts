import { beforeEach, describe, expect, it, vi } from 'vitest';

const { captureEvent } = vi.hoisted(() => ({ captureEvent: vi.fn() }));
vi.mock('@sentry/sveltekit', () => ({ captureEvent }));

import {
	reportOperationalFailure,
	resetOperationalFailureStateForTests,
	setOperationalDeployment,
} from './operational_failures.js';

describe('operational failure reporting', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		captureEvent.mockClear();
		resetOperationalFailureStateForTests();
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
	});

	it('emits safe stable metadata and a cross-isolate fingerprint', () => {
		setOperationalDeployment('deployment-1');
		reportOperationalFailure('resend', 'provider_unavailable');

		expect(captureEvent).toHaveBeenCalledWith(
			expect.objectContaining({ fingerprint: ['operational:resend:provider_unavailable'] }),
		);
		expect(console.error).toHaveBeenCalledWith({
			event: 'operational_failure',
			component: 'resend',
			reason: 'provider_unavailable',
			deploymentVersionId: 'deployment-1',
			fingerprint: 'operational:resend:provider_unavailable',
		});
	});

	it('logs a missing Sentry DSN without trying to report through Sentry', () => {
		reportOperationalFailure('sentry', 'missing_public_dsn');
		expect(console.error).toHaveBeenCalledOnce();
		expect(captureEvent).not.toHaveBeenCalled();
	});

	it('deduplicates floods with a bounded LRU', () => {
		reportOperationalFailure('resend', 'reason-0');
		reportOperationalFailure('resend', 'reason-0');
		expect(captureEvent).toHaveBeenCalledTimes(1);

		for (let index = 1; index <= 64; index += 1) {
			reportOperationalFailure('resend', `reason-${index}`);
		}
		reportOperationalFailure('resend', 'reason-0');
		expect(captureEvent).toHaveBeenCalledTimes(66);
	});
});
