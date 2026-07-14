import { describe, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { createRequestTelemetryHandle } from './request_telemetry.js';

function createEvent(): RequestEvent {
	return {
		request: new Request('https://prejemesi.cz/en/w/private?token=secret', {
			method: 'POST',
			headers: { authorization: 'Bearer private' },
			body: 'email=private@example.com',
		}),
		route: { id: '/[[lang=locale]]/w/[id]' },
		platform: { env: { CF_VERSION_METADATA: { id: 'version-123' } } },
	} as unknown as RequestEvent;
}

describe('request telemetry', () => {
	it('writes privacy-safe start and completion records', async () => {
		const write = vi.fn();
		const now = vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(112.6);
		const handle = createRequestTelemetryHandle({ write, now });

		await handle({
			event: createEvent(),
			resolve: vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
		});

		expect(write).toHaveBeenNthCalledWith(1, {
			phase: 'start',
			routeId: '/[[lang=locale]]/w/[id]',
			method: 'POST',
			deploymentVersionId: 'version-123',
		});
		expect(write).toHaveBeenNthCalledWith(2, {
			phase: 'complete',
			routeId: '/[[lang=locale]]/w/[id]',
			method: 'POST',
			status: 204,
			outcome: 'success',
			durationMilliseconds: 13,
			deploymentVersionId: 'version-123',
		});

		const serializedRecords = JSON.stringify(write.mock.calls);
		expect(serializedRecords).not.toContain('private');
		expect(serializedRecords).not.toContain('secret');
		expect(serializedRecords).not.toContain('authorization');
		expect(serializedRecords).not.toContain('email');
	});

	it('records a safe failure outcome and rethrows hook failures', async () => {
		const write = vi.fn();
		const handle = createRequestTelemetryHandle({
			write,
			now: vi.fn().mockReturnValueOnce(20).mockReturnValueOnce(25),
		});
		const failure = new Error('private@example.com token=secret');

		await expect(
			handle({ event: createEvent(), resolve: vi.fn().mockRejectedValue(failure) }),
		).rejects.toBe(failure);

		expect(write).toHaveBeenLastCalledWith({
			phase: 'complete',
			routeId: '/[[lang=locale]]/w/[id]',
			method: 'POST',
			status: 500,
			outcome: 'unhandled_error',
			durationMilliseconds: 5,
			deploymentVersionId: 'version-123',
		});
	});

	it.each([
		[399, 'success'],
		[400, 'client_error'],
		[499, 'client_error'],
		[500, 'server_error'],
	] as const)('classifies response status %s as %s', async (status, outcome) => {
		const write = vi.fn();
		const handle = createRequestTelemetryHandle({
			write,
			now: vi.fn().mockReturnValueOnce(10).mockReturnValueOnce(11),
		});

		await handle({
			event: createEvent(),
			resolve: vi.fn().mockResolvedValue(new Response(null, { status })),
		});

		expect(write).toHaveBeenLastCalledWith(
			expect.objectContaining({ phase: 'complete', status, outcome }),
		);
	});
});
