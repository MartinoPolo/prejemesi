import assert from 'node:assert/strict';
import test from 'node:test';
import { assignedService } from './development-service-environment.mjs';

test('pins the local preview worker origin to its MPX-assigned URL', () => {
	assert.deepEqual(assignedService('http://localhost:8306', '8301'), {
		port: '8306',
		origin: 'http://localhost:8306',
	});
});
