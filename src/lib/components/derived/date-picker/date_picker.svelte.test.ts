import '../../../../app.css';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

vi.mock('$env/dynamic/public', () => ({ env: {} }));

const { default: DatePicker } = await import('./DatePicker.svelte');

afterEach(async () => page.viewport(1280, 720));

describe('DatePicker control sizing', () => {
	it('uses responsive sizing when omitted while an explicit large size stays fixed', async () => {
		const defaultScreen = await render(DatePicker, { placeholder: 'Responsive date' });
		const largeScreen = await render(DatePicker, {
			placeholder: 'Large date',
			size: 'lg',
		});
		const responsiveTrigger = defaultScreen
			.getByRole('button', {
				name: 'Responsive date',
			})
			.element();
		const largeTrigger = largeScreen.getByRole('button', { name: 'Large date' }).element();

		await page.viewport(390, 720);
		expect(responsiveTrigger.getBoundingClientRect().height).toBe(40);
		expect(largeTrigger.getBoundingClientRect().height).toBe(40);

		await page.viewport(1280, 720);
		expect(responsiveTrigger.getBoundingClientRect().height).toBe(32);
		expect(largeTrigger.getBoundingClientRect().height).toBe(40);
	});
});
