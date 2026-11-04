import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import Alert from './Alert.svelte';
import AlertTestFixture from './alert_test_fixture.svelte';
import { ALERT_TONES, type AlertTone } from './alert_variants.js';

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

	it.each(ALERT_TONES)('sets the %s body in regular weight below a medium title', (tone) => {
		const { container } = render(AlertTestFixture, { tone });
		const fontWeight = (slot: string) => {
			const element = container.querySelector(`[data-slot="${slot}"]`);
			if (element === null) {
				throw new Error(`Missing ${slot}`);
			}
			return getComputedStyle(element).fontWeight;
		};
		expect(fontWeight('alert-description')).toBe('400');
		expect(fontWeight('alert-title')).toBe('500');
	});
});
