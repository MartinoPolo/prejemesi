import type { Handle } from '@sveltejs/kit';

type RequestOutcome = 'success' | 'client_error' | 'server_error' | 'unhandled_error';

interface CommonRequestTelemetry {
	routeId: string;
	method: string;
	deploymentVersionId: string;
}

interface RequestStartTelemetry extends CommonRequestTelemetry {
	phase: 'start';
}

interface RequestCompleteTelemetry extends CommonRequestTelemetry {
	phase: 'complete';
	status: number;
	outcome: RequestOutcome;
	durationMilliseconds: number;
}

type RequestTelemetry = RequestStartTelemetry | RequestCompleteTelemetry;

interface RequestTelemetryDependencies {
	write?: (telemetry: RequestTelemetry) => void;
	now?: () => number;
}

function classifyOutcome(status: number): Exclude<RequestOutcome, 'unhandled_error'> {
	if (status >= 500) {
		return 'server_error';
	}
	if (status >= 400) {
		return 'client_error';
	}
	return 'success';
}

export function createRequestTelemetryHandle({
	write = (telemetry) => console.info(telemetry),
	now = () => performance.now(),
}: RequestTelemetryDependencies = {}): Handle {
	return async ({ event, resolve }) => {
		const startedAt = now();
		const commonTelemetry = {
			routeId: event.route.id ?? 'unmatched',
			method: event.request.method,
			deploymentVersionId: event.platform?.env.CF_VERSION_METADATA?.id ?? 'local',
		};

		write({ phase: 'start', ...commonTelemetry });

		try {
			const response = await resolve(event);
			write({
				phase: 'complete',
				...commonTelemetry,
				status: response.status,
				outcome: classifyOutcome(response.status),
				durationMilliseconds: Math.round(now() - startedAt),
			});
			return response;
		} catch (error) {
			write({
				phase: 'complete',
				...commonTelemetry,
				status: 500,
				outcome: 'unhandled_error',
				durationMilliseconds: Math.round(now() - startedAt),
			});
			throw error;
		}
	};
}

export const requestTelemetryHandle = createRequestTelemetryHandle();
