import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import Alert from './Alert.svelte';
import type { AlertTone } from './alert_variants.js';

describe('Alert', () => {
	it.each<[AlertTone, string]>([
		['danger', 'alert'],
		['success', 'status'],
		['warning', 'note'],
		['info', 'note'],
	])('announces a %s callout with the %s role', (tone, role) => {
		const { container } = render(Alert, { tone });
		expect(container.querySelector('[data-slot="alert"]')?.getAttribute('role')).toBe(role);
	});

	it('defaults to the info tone note role', () => {
		const { container } = render(Alert, {});
		expect(container.querySelector('[data-slot="alert"]')?.getAttribute('role')).toBe('note');
	});

	it('lets a caller override the role', () => {
		const { container } = render(Alert, { tone: 'warning', role: 'alert' });
		expect(container.querySelector('[data-slot="alert"]')?.getAttribute('role')).toBe('alert');
	});
});
