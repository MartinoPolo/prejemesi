import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { afterEach, describe, expect, it } from 'vitest';
import LogoMark from './LogoMark.svelte';
import * as m from '$lib/paraglide/messages.js';

describe('LogoMark mobile app bar treatment (#340)', () => {
	afterEach(async () => page.viewport(1280, 720));

	it('keeps the tilted 40px gift mark and core wordmark visible at supported widths', async () => {
		for (const width of [320, 360, 390]) {
			await page.viewport(width, 720);
			const screen = await render(LogoMark);
			const logo = screen.getByRole('link', { name: m.logo_home_label() }).element();
			const mark = logo.querySelector('.logo-icon-wrap') as HTMLElement;
			const wordmark = logo.querySelector('.logo-text') as HTMLElement;
			expect(getComputedStyle(mark).width).toBe('40px');
			expect(getComputedStyle(mark).height).toBe('40px');
			expect(getComputedStyle(mark).transform).not.toBe('none');
			expect(getComputedStyle(wordmark).display).not.toBe('none');
			expect(wordmark).toHaveTextContent('přejeme si');
			expect(logo.scrollWidth).toBeLessThanOrEqual(logo.clientWidth);
			await screen.unmount();
		}
	});

	it('collapses only the optional country suffix at the narrowest width', async () => {
		await page.viewport(320, 720);
		const screen = await render(LogoMark);
		const logo = screen.getByRole('link', { name: m.logo_home_label() }).element();
		const suffix = logo.querySelector('.logo-tld') as HTMLElement;
		expect(getComputedStyle(suffix).display).toBe('none');
		expect(getComputedStyle(logo.querySelector('.logo-text') as HTMLElement).display).not.toBe(
			'none',
		);
		await screen.unmount();
	});
});
