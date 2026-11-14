import * as Sentry from '@sentry/sveltekit';

export type OperationalComponent = 'database' | 'auth' | 'sentry' | 'resend' | 'turnstile';
export type OperationalSeverity = 'error' | 'warning';

const MAX_RECENT_FAILURES = 64;
const recentFailures = new Map<string, true>();
let deploymentId = 'local';

export function setOperationalDeployment(id: string | undefined): void {
	const trimmedId = id?.trim();
	deploymentId = trimmedId !== undefined && trimmedId.length > 0 ? trimmedId : 'local';
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
export function reportOperationalFailure(
	component: OperationalComponent,
	reason: string,
	severity: OperationalSeverity = 'error',
): void {
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
	if (severity === 'warning') {
		console.warn(metadata);
	} else {
		console.error(metadata);
	}

	if (component !== 'sentry') {
		Sentry.captureEvent({
			message: `Operational failure: ${component}/${reason}`,
			level: severity,
			fingerprint: [fingerprint],
			contexts: { operational: metadata },
		});
	}
}

export function resetOperationalFailureStateForTests(): void {
	recentFailures.clear();
	deploymentId = 'local';
}
