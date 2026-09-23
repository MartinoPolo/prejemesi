import type { Page } from '@playwright/test';

export function collectBrowserDiagnostics(page: Page): () => string {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
	page.on('console', (message) => {
		if (message.type() === 'error') {
			errors.push(`console: ${message.text()}`);
		}
	});
	page.on('requestfailed', (request) =>
		errors.push(`requestfailed: ${request.url()} (${request.failure()?.errorText})`),
	);
	page.on('response', (response) => {
		if (response.status() >= 400) {
			errors.push(`http ${response.status()}: ${response.url()}`);
		}
	});
	return () => [`url: ${page.url()}`, ...errors].join('\n');
}
