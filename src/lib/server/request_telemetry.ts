import type { Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import {
	exposesServerTiming,
	serverTimingHeader,
	startServerTiming,
	stopServerTiming,
} from './server_timing.js';

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
	exposeServerTiming?: () => boolean;
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

/** Timing is diagnostic, so a response whose headers cannot change is returned without it. */
function setServerTimingHeader(response: Response, value: string): void {
	try {
		response.headers.set('Server-Timing', value);
	} catch {
		// Immutable headers, such as on Response.redirect() or a proxied fetch response.
	}
}

export function createRequestTelemetryHandle({
	write = (telemetry) => console.info(telemetry),
	now = () => performance.now(),
	exposeServerTiming = () => exposesServerTiming(env.ORIGIN),
}: RequestTelemetryDependencies = {}): Handle {
	return async ({ event, resolve }) => {
		const startedAt = now();
		const commonTelemetry = {
			routeId: event.route.id ?? 'unmatched',
			method: event.request.method,
			deploymentVersionId: event.platform?.env.CF_VERSION_METADATA?.id ?? 'local',
		};

		write({ phase: 'start', ...commonTelemetry });
		if (exposeServerTiming()) {
			startServerTiming(event);
		}

		try {
			const response = await resolve(event);
			const durationMilliseconds = now() - startedAt;
			write({
				phase: 'complete',
				...commonTelemetry,
				status: response.status,
				outcome: classifyOutcome(response.status),
				durationMilliseconds: Math.round(durationMilliseconds),
			});
			const timingHeader = serverTimingHeader(event, durationMilliseconds);
			if (timingHeader !== undefined) {
				setServerTimingHeader(response, timingHeader);
			}
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
		} finally {
			stopServerTiming(event);
		}
	};
}

export const requestTelemetryHandle = createRequestTelemetryHandle();
