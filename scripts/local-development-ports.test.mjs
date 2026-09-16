import assert from 'node:assert/strict';
import test from 'node:test';
import {
	PARALLEL_APPLICATION_ORIGINS,
	PARALLEL_APPLICATION_PORT_COUNT,
	PREFERRED_APPLICATION_ORIGIN,
	PREFERRED_APPLICATION_PORT,
} from './local-development-ports.mjs';

test('defines the conventional five-port interactive pool from the preferred port', () => {
	assert.equal(PREFERRED_APPLICATION_PORT, 8300);
	assert.equal(PREFERRED_APPLICATION_ORIGIN, 'http://localhost:8300');
	assert.equal(PARALLEL_APPLICATION_PORT_COUNT, 5);
	assert.deepEqual(PARALLEL_APPLICATION_ORIGINS, [
		'http://localhost:8300',
		'http://localhost:8301',
		'http://localhost:8302',
		'http://localhost:8303',
		'http://localhost:8304',
	]);
});
