import { test, expect } from '@playwright/test';

test('the retired gift ingestion endpoint answers 404, even with a bearer token', async ({
	request,
	baseURL,
}) => {
	for (const mode of ['dry-run', 'apply']) {
		const response = await request.post(`${baseURL}/api/internal/v1/gift-ingestion`, {
			headers: { Authorization: 'Bearer retired-ingestion-token' },
			data: { schemaVersion: 1, mode },
		});

		expect(response.status()).toBe(404);
	}
});
