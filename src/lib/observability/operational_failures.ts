import * as Sentry from '@sentry/sveltekit';

export type OperationalComponent = 'database' | 'auth' | 'sentry' | 'resend' | 'turnstile';

const MAX_RECENT_FAILURES = 64;
const recentFailures = new Map<string, true>();
let deploymentId = 'local';

export function setOperationalDeployment(id: string | undefined): void {
	deploymentId = id?.trim() || 'local';
}

function remember(key: string): boolean {
	if (recentFailures.has(key)) {
		recentFailures.delete(key);
		recentFailures.set(key, true);
		return false;
	}
	recentFailures.set(key, true);
	if (recentFailures.size > MAX_RECENT_FAILURES) {
		const oldest = recentFailures.keys().next().value;
		if (oldest !== undefined) {
			recentFailures.delete(oldest);
		}
	}
	return true;
}

/** Reports only stable, non-user operational metadata. */
export function reportOperationalFailure(component: OperationalComponent, reason: string): void {
	const fingerprint = `operational:${component}:${reason}`;
	const key = `${deploymentId}:${fingerprint}`;
	if (!remember(key)) {
		return;
	}

	const metadata = {
		event: 'operational_failure',
		component,
		reason,
		deploymentVersionId: deploymentId,
		fingerprint,
	};
	console.error(metadata);

	if (component !== 'sentry') {
		Sentry.captureEvent({
			message: `Operational failure: ${component}/${reason}`,
			level: 'error',
			fingerprint: [fingerprint],
			contexts: { operational: metadata },
		});
	}
}

export function resetOperationalFailureStateForTests(): void {
	recentFailures.clear();
	deploymentId = 'local';
}
